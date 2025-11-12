using {cuid} from '@sap/cds/common';

namespace sap.cap;

@(impl: 'srv/trc/index.js')
service trc {

  @cache.ttl: '1m'
  entity traces : cuid {
    // relation
    correlation : UUID;
    parent      : Association to one traces;
    children    : Association to many traces
                    on children.parent = $self;

    // time
    start       : Timestamp;
    end         : Timestamp;

    // machine
    server      : String(1024);
    domain      : String(1024);

    // information
    name        : String(1024);
    details     : Map;
  };

}
