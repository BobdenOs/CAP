const parsers = {
  5: function (start) {
    return {
      alias: this._label(start).name,
    };
  },
  6: function (start) {
    const mname = this._label(start);
    const rname = this._label(mname.end + 1);

    const offset = rname.end + 1;
    const serial = this.buffer.readUInt32BE(offset);
    const refresh = this.buffer.readUInt32BE(offset + 4);
    const retry = this.buffer.readUInt32BE(offset + 8);
    const expire = this.buffer.readUInt32BE(offset + 12);
    const minimum = this.buffer.readUInt32BE(offset + 16);

    return { mname, rname, serial, refresh, retry, expire, minimum };
  },
};
parsers["39"] = parsers["5"];

class Message {
  constructor(buffer) {
    this.buffer = buffer;
  }

  static from(question) {
    const buffer = Buffer.allocUnsafe(12);
    const ret = new Message(buffer);
    ret.id = Math.random() * 0xffff;
    ret.flags = 288;
    ret.questions = question ? [question] : [];
    ret.answers = [];
    ret.authorities = [];
    ret.additional = [];

    return ret;
  }

  static parsers = parsers;

  get id() {
    return this.buffer.readUInt16BE(0);
  }

  set id(id) {
    this.buffer.writeUInt16BE(id | 0, 0);
  }

  get flags() {
    return this.buffer.readUInt16BE(2);
  }

  set flags(flags) {
    this.buffer.writeUInt16BE(flags, 2);
  }

  _label(start) {
    const labels = [];
    for (var i = start; i < this.buffer.byteLength; i++) {
      const length = this.buffer.readUInt8(i);
      if (length === 0) break;
      const isPointer = (length & 0xc0) === 0xc0;
      if (isPointer) {
        const pointer = this._label(this.buffer.readUInt16BE(i) - 0xc000);
        labels.push(...pointer.name);
        i += 1;
        break;
      }

      labels.push(this.buffer.slice(i + 1, i + length + 1));
      i += length;
    }

    return {
      start,
      end: i,
      name: labels,
    };
  }

  _question(start = 12) {
    const ret = this._label(start);
    ret.type = this.buffer.readUInt16BE(ret.end + 1);
    ret.class = this.buffer.readUInt16BE(ret.end + 3);
    ret.end += 5;
    ret.buffer = this.buffer.slice(start, ret.end);
    return ret;
  }

  _answer(start) {
    const ret = this._label(start);
    ret.type = this.buffer.readUInt16BE(ret.end + 1);
    ret.class = this.buffer.readUInt16BE(ret.end + 3);
    ret.ttl = this.buffer.readUInt32BE(ret.end + 5);
    if (ret.ttl < 1) {
      this.buffer.writeUInt32BE(10, ret.end + 5);
      ret.ttl = 10;
    }
    ret.length = this.buffer.readUInt16BE(ret.end + 9);
    ret.data = this.buffer.slice(ret.end + 11, ret.end + 11 + ret.length);

    const parser = Message.parsers[ret.type];
    if (parser) {
      Object.assign(ret, parser.call(this, ret.end + 11));
    }

    ret.end += 11 + ret.length;
    ret.buffer = this.buffer.slice(start, ret.end);
    return ret;
  }

  get questions() {
    const length = this.buffer.readUInt16BE(4);
    const questions = new Array(length);

    for (let i = 0; i < length; i++) {
      questions[i] = this._question(questions[i - 1]?.end || 12);
    }

    super.questions = questions;
    return questions;
  }

  set questions(questions) {
    const length = questions.length;
    this.buffer.writeUInt16BE(length, 4);

    let totalSize = 0;
    for (const question of questions) {
      if (!question.buffer) {
        let offset = 0;
        question.buffer = Buffer.allocUnsafe(question.name.length + 6);
        question.name = question.name.split(/[.,]/).map((label) => {
          question.buffer.writeUInt8(label.length, offset++);
          question.buffer.write(label, offset, label.length, "ascii");
          offset += label.length;
          return question.buffer.subarray(offset, offset + label.length)
        });
        question.buffer.writeUInt8(0, offset++);
        question.buffer.writeUInt16BE(question.type, offset);
        question.buffer.writeUInt16BE(question.class || 1, offset + 2);
      }

      totalSize += question.buffer.byteLength;
    }

    const header = this.buffer;
    this.buffer = Buffer.allocUnsafe(12 + totalSize);
    header.copy(this.buffer, 0, 0, 12);

    let offset = 12;
    for (const question of questions) {
      question.buffer.copy(this.buffer, offset);
      offset += question.buffer.byteLength;
    }
  }

  get answers() {
    const length = this.buffer.readUInt16BE(6);
    const answers = new Array(length);
    super.answers = answers;

    if (length === 0) return [];

    const start = this.questions.at(-1)?.end || 12;
    for (let i = 0; i < length; i++) {
      answers[i] = this._answer(answers[i - 1]?.end || start);
    }
    return answers;
  }

  set answers(answers) {
    const length = answers.length;
    this.buffer.writeUInt16BE(length, 6);

    let totalSize = 0;
    for (const answer of answers) {
      if (!answer.buffer) {
        let offset = 0;
        answer.buffer = Buffer.allocUnsafe(
          answer.name.length + 12 + answer.data.byteLength
        );
        answer.name.split(",").map((label) => {
          answer.buffer.writeUInt8(label.length, offset++);
          answer.buffer.write(label, offset, label.length, "ascii");
          offset += label.length;
        });
        answer.buffer.writeUInt8(0, offset++);

        answer.buffer.writeUInt16BE(answer.type, offset);
        answer.buffer.writeUInt16BE(answer.class || 1, offset + 2);
        answer.buffer.writeUInt32BE(answer.ttl || 0, offset + 4);
        answer.buffer.writeUInt16BE(answer.data.byteLength, offset + 8);
        answer.data.copy(answer.buffer, offset + 10);
      }

      totalSize += answer.buffer.byteLength;
    }

    const header = this.buffer;
    this.buffer = Buffer.allocUnsafe(header.byteLength + totalSize);
    header.copy(this.buffer, 0, 0, header.byteLength);

    let offset = header.byteLength;
    for (const answer of answers) {
      answer.buffer.copy(this.buffer, offset);
      offset += answer.buffer.byteLength;
    }
  }

  get authorities() {
    const length = this.buffer.readUInt16BE(8);
    const authorities = new Array(length);
    super.authorities = authorities;

    if (length === 0) return [];

    const start = this.answers.at(-1)?.end || this.questions.at(-1)?.end || 12;
    for (let i = 0; i < length; i++) {
      authorities[i] = this._answer(authorities[i - 1]?.end || start);
    }
    return authorities;
  }

  set authorities(authorities) {
    const length = authorities.length;
    this.buffer.writeUInt16BE(length, 8);
  }

  get additional() {
    const length = this.buffer.readUInt16BE(10);
    const additional = new Array(length);
    super.additional = additional;

    if (length === 0) return [];

    const start =
      this.authorities.at(-1)?.end ||
      this.answers.at(-1)?.end ||
      this.questions.at(-1)?.end ||
      12;
    for (let i = 0; i < length; i++) {
      additional[i] = this._answer(additional[i - 1]?.end || start);
    }
    return additional;
  }

  set additional(additional) {
    const length = additional.length;
    this.buffer.writeUInt16BE(length, 10);
  }
}

module.exports = Message;
