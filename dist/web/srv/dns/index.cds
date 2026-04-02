namespace sap.cap;

@(impl: 'srv/dns/index.js')
service dns {
  @(
    cds.persistence.skip,
    dns.type: 5,
  )
  entity CNAME {
    key name  : name;
    key alias : name;
  };

  @(
    cds.persistence.skip,
    dns.type: 1,
  )
  entity A {
    key name : name;
    key ip   : Binary(4);
        url  : String(15);
  };

  @(
    cds.persistence.skip,
    dns.type: 28,
  )
  entity AAAA {
    key name : name;
    key ip   : Binary(16);
        url  : String(39);
  };

  @(
    cds.persistence.skip,
    dns.type: 65,
  )
  entity HTTPS {
    key name  : name;
        alias : name;
  };
}

type name : String(5000);
