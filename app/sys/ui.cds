using {
  sap.cap.dns.A,
  sap.cap.dns.AAAA,
} from '@cap-community/cap/srv/dns';

////////////////////////////////////////////////////////////////////////////
//
//	Books Object Page
//
annotate A with @(
  Common.SemanticKey: [
    (name),
    (url)
  ],
  UI                : {
    Identification        : [{Value: name}],
    HeaderInfo            : {
      TypeName      : '{i18n>address}',
      TypeNamePlural: '{i18n>addresses}',
      Description   : {Value: name},
    },

    SelectionFields       : [name],

    HeaderFacets          : [],

    Facets                : [],

    LineItem              : [
      {
        Value             : (name),
        @HTML5.CssDefaults: {width: 'auto'},
      },
      {
        Value             : (ip),
        @HTML5.CssDefaults: {width: '140px'}
      },
      {
        Value             : (url),
        @HTML5.CssDefaults: {width: '200px'},
      }
    ],

    LineItem #OverviewCard: [
      // {
      //     $Type: 'UI.DataFieldForIntentBasedNavigation',
      //     SemanticObject: 'ClosingTask',
      //     Action: 'displayClosingCompletionForTasks'
      // },
      {
        $Type         : 'UI.DataField',
        Value         : name,
        @UI.Importance: #High
      },
      // {
      //     $Type: 'UI.DataFieldForAnnotation',
      //     Target: '@UI.DataPoint#CompletionRate'
      // },
      // {
      //     $Type: 'UI.DataFieldForAnnotation',
      //     Target: '@UI.DataPoint#NumberOfErroneousTasks'
      // },
      {
        $Type: 'UI.DataField',
        Value: url
      }
    ],
  }
);

annotate AAAA with @(
  Common.SemanticKey: [
    (name),
    (url)
  ],
  UI                : {
    Identification        : [{Value: name}],
    HeaderInfo            : {
      TypeName      : '{i18n>address}',
      TypeNamePlural: '{i18n>addresses}',
      Description   : {Value: name},
    },

    SelectionFields       : [name],

    HeaderFacets          : [],

    Facets                : [],

    LineItem              : [
      {
        Value             : (name),
        @HTML5.CssDefaults: {width: 'auto'},
      },
      {
        Value             : (ip),
        @HTML5.CssDefaults: {width: '140px'}
      },
      {
        Value             : (url),
        @HTML5.CssDefaults: {width: '300px'},
      }
    ],

    LineItem #OverviewCard: [
      // {
      //     $Type: 'UI.DataFieldForIntentBasedNavigation',
      //     SemanticObject: 'ClosingTask',
      //     Action: 'displayClosingCompletionForTasks'
      // },
      {
        $Type         : 'UI.DataField',
        Value         : name,
        @HTML5.CssDefaults: {width: '200px'},
        @UI.Importance: #High
      },
      // {
      //     $Type: 'UI.DataFieldForAnnotation',
      //     Target: '@UI.DataPoint#CompletionRate'
      // },
      // {
      //     $Type: 'UI.DataFieldForAnnotation',
      //     Target: '@UI.DataPoint#NumberOfErroneousTasks'
      // },
      {
        $Type: 'UI.DataField',
        @HTML5.CssDefaults: {width: '300px'},
        Value: url
      }
    ],
  }
);