namespace sap.cap;

@(impl: 'srv/app/index.js')
service app {
  @(cds.persistence.skip)
  entity applications {
    key name    : String(5000);
        port    : Integer;
        state   : String enum {
          deploying;
          upgrading;
          running;
          stopping;
        };

        @(Core.IsMediaType)
        srcType : String(5000);

        @(Core.MediaType: srcType)
        src     : LargeBinary;
  };
}
