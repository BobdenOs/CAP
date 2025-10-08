namespace sap.cap;

@(impl: 'srv/db/index.js')
service db {
  entity dummy {
    X : String;
  }
}
