namespace sap.cap;

@(impl: 'srv/fs/index.js')
service fs {

  @cache.ttl: '1m'
  entity files {
    key owner    : String(5000);
    key name     : String(5000);

        @(Core.IsMediaType)
        dataType : String(5000);

        chunks   : Association to many chunks
                     on chunks.file = $self;
  };

  @cache.ttl: '1m'
  entity chunks {
    key file   : Association to one files;
    key index  : Integer;
        domain : String(5000);

        @(Core.MediaType: 'application/octet-stream')
        data   : LargeBinary;
        size   : Int64;

        local  : Boolean;
  }
}
