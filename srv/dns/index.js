const cds = require("@sap/cds");
const cqn4sql = require("@cap-js/db-service/lib/cqn4sql");

const util = require("util");

const dns = require("dns");
const dgram = require("dgram");

const WeakCache = require('./weakcache')
const Message = require('./message')

module.exports = class DNSService extends cds.ApplicationService {
  async init() {
    this._store = {
      1: {}, // A
      5: {}, // CNAME
      28: {}, // AAAA
    };
    this._cache = {
      1: new WeakCache(), // A
      5: new WeakCache(), // CNAME
      28: new WeakCache(), // AAAA
    };

    this.on(["SELECT"], this.onSELECT);
    this.on(["INSERT"], this.onINSERT);

    return this.listen(5353);
  }

  async listen(port) {
    this._fallback = dns.getServers();

    this._controller = new AbortController();
    const { signal } = this._controller;

    // Start UDP server
    const server = (this.server = dgram.createSocket({ type: "udp4", signal }));

    server.on("message", this.handler.bind(this));

    await util.promisify(server.bind.bind(server))(port);
    // Uses localhost for all dns calls (except lookup)
    dns.setServers([`127.0.0.1:${port}`]);
    // Make lookup query the dns logic directly
    const orgLookup = dns.lookup;
    dns.lookup = async function (host, options, cb) {
      // TCP and UDP also call lookup internally
      // Test if url is an ip address
      let valid = !!urlToIp(host, 1);
      let type = 4;
      if (valid && (typeof options !== "number" || type === options))
        return cb(null, host, type);

      valid = !!urlToIp(host, 28);
      type = 6;
      if (valid && (typeof options !== "number" || type === options))
        return cb(null, host, type);

      // Resolve host name
      const msg = Message.from({
        type: options === 4 ? 1 : options === 6 ? 28 : 255,
        name: host,
      });
      const result = new Message(await this.resolve(msg.buffer));
      const answers = result.answers;

      // If not found use default lookup to keep errors consistent
      if (answers.length === 0) {
        return orgLookup(host, options, cb);
      }

      const answer = answers[0];
      return cb(null, ipToUrl(answer.data), answer.type === 1 ? 4 : 6);
    }.bind(this);
  }

  async disconnect() {
    return Promise((resolve, reject) => {
      this.server.on("error", reject);
      this.server.on("close", resolve);
      this._controller.abort();
    });
  }

  async handler(msg, remote) {
    const res = await this.resolve(msg);
    return this.respond(res, remote);
  }

  async resolve(msg) {
    const req = this.parse(msg);

    let results = [];
    const unknown = [];
    for (const question of req.questions) {
      const cache = this.cache(question);
      if (cache) {
        results.push(cache);
      } else {
        unknown.push(question);
      }
    }

    // Forward unknown questions and update cache
    if (unknown.length) {
      const res = await this.forward(msg);

      res.authorities;

      // Clear results and old cache entries
      results = [];
      for (const answer of res.answers) {
        this._cache[answer.type]?.delete(answer.name);
      }

      // Update cache
      for (const answer of res.answers) {
        this._cache[answer.type]?.set(answer.name, answer);
        results.push(answer);
      }
    }

    results = results.flat();
    const copy = Buffer.allocUnsafe(
      msg.byteLength + results.reduce((l, c) => l + c.buffer.byteLength, 0)
    );

    let offset = msg.byteLength;
    msg.copy(copy, 0, 0, msg.byteLength);
    for (const result of results) {
      result.buffer.copy(copy, offset, 0, result.buffer.byteLength);
      offset += result.buffer.byteLength;
    }

    // Set response flag
    copy.writeUInt16BE(copy.readUInt16BE(2) | (1 << 15), 2);
    copy.writeUInt16BE(results.length, 6);
    return copy;
  }

  async forward(msg) {
    const errors = [];
    for (const server of this._fallback) {
      try {
        return await new Promise((resolve, reject) => {
          const socket = dgram.createSocket({ type: "udp4" });
          socket.on("error", reject);
          socket.on("message", (msg) => resolve(this.parse(msg)));
          socket.send(msg, 0, msg.length, server.split(":")[1] || 53, server);
        });
      } catch (err) {
        errors.push(err);
      }
    }
    throw new Error(`No DNS server available: ${errors.join("\n")}`);
  }

  async respond(result, remote) {
    const buffer = result;
    this.server.sendto(
      buffer,
      0,
      buffer.byteLength,
      remote.port,
      remote.address,
      (err) => {
        if (err) {
          console.log(err);
        }
      }
    );
  }

  parse(buf) {
    return new Message(buf);
  }

  cache(question) {
    if (question.type === 255) {
      return [
        ...(this.cache({ type: 1, name: question.name }) || []),
        ...(this.cache({ type: 28, name: question.name }) || []),
      ];
    }

    const local = this._store[question.type]?.[question.name];
    if (local) return local;

    const typeCache = this._cache[question.type]?.get(question.name);
    if (typeCache) return typeCache;

    const cnameCache = this._cache[5]?.get(question.name);
    if (cnameCache) {
      let totalCache = [];
      for (const cname of cnameCache) {
        const ret = this.cache({ type: question.type, name: cname.alias });
        if (!ret) return;
        totalCache = [...totalCache, cname, ...ret];
      }
      return totalCache;
    }
  }

  async onSELECT(req) {
    const filter = (answer) => answer.type === type
    const parser = (answer) => ({
      name: answer.name.join("."),
      ip: answer.data,
      url: ipToUrl(answer.data),
    });

    const q = cqn4sql(req.query, this.model);

    const type = q.target["@dns.type"];
    const name = q.SELECT.where
      ?.find((c) => typeof c.val === "string")
      .val.split(".")
      .join(",");

    if (!name) {
      return Object.keys(this._store[type])
        .map((name) => {
          const store = this._store[type][name];
          return store.filter(filter).map(parser);
        })
        .flat();
    }

    const question = { type, name };

    const msg = Message.from(question);

    let result = this.cache(question);
    if (result) {
      // Convert cache into Message object
      msg.answers = result;
      result = msg;
    } else {
      result = this.parse(await this.resolve(msg.buffer));
    }

    if (!result) return;

    return result.answers.filter(filter).map(parser);
  }

  async onINSERT(req) {
    const q = cqn4sql(req.query, this.model);

    const type = q.target["@dns.type"];

    toEntries(q);

    const entries = q.INSERT.entries;

    const errors = [];
    const answers = [];
    for (let entry of entries) {
      const name = entry.name;
      const ip = entry.ip || (entry.url && urlToIp(entry.url, type));
      if (!name && !ip) continue;
      if (!name) {
        errors.push(new Error(`Missing name for "${ip}"`));
        continue;
      }
      if (!ip) {
        errors.push(new Error(`Missing ip for "${name}"`));
        continue;
      }

      answers.push({
        name: name.split(".").join(","),
        type,
        class: 1,
        ttl: 3600,
        length: ip.byteLength,
        data: ip,
      });
    }
    if (errors.length)
      throw new Error("Errors occured: " + errors.join("\n\n"));

    const msg = Message.from();
    msg.answers = answers;
    const parsedAnswers = msg.answers;

    for (const answer of parsedAnswers) {
      const store = (this._store[answer.type][answer.name] =
        this._store[answer.type][answer.name] || []);
      store.push(answer);
    }

    return answers.length;
  }
};

const urlToIp = (url, type) => {
  const ipv4 = (url) => {
    const split = url.split(".");
    if (split.length !== 4) return;
    for (let i = 0; i < split.length; i++) {
      split[i] = Number.parseInt(split[i], 10);
      // Using < to include NaN
      if (!(split[i] < 256)) return;
    }
    return Buffer.from(split);
  };
  const ipv6 = (url) => {
    const parts = url
      .split(":")
      .map((p, i, arr) =>
        p === "" && i > 0
          ? "".padStart((9 - arr.length) * 4, "0")
          : p.padStart(4, "0")
      );
    const str = parts.join("");
    if (str.length !== 32) return;
    return Buffer.from(str, "hex");
  };

  return type === 1 ? ipv4(url) : type === 28 ? ipv6(url) : url;
};

const ipToUrl = (ip) => {
  return ip.byteLength === 4
    ? [...ip].join(".")
    : ip
        .toString("hex")
        .match(/.{1,4}/g)
        .join(":");
};

const toEntries = (q) => {
  const { INSERT } = q;
  if (INSERT.entries) return;
  if (!INSERT.columns) {
    INSERT.entries = [];
    return;
  }
  const columns = INSERT.columns;
  const values = INSERT.rows || INSERT.values ? [INSERT.values] : [];
  INSERT.entries = values.map((row) => {
    const entry = {};
    for (let i = 0; i < columns.length; i++) {
      entry[columns[i]] = row[i];
    }
    return entry;
  });
};
