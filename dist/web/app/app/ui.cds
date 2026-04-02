using {
  sap.cap.app.applications,
} from '@cap-community/cap/srv/app';

annotate applications with @(
  Common.SemanticKey: [(name)],
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
        Value             : (state),
        @HTML5.CssDefaults: {width: '140px'}
      }
    ],

    LineItem #OverviewCard: [
      {
        $Type         : 'UI.DataField',
        Value         : name,
        @UI.Importance: #High
      },
      {
        $Type: 'UI.DataField',
        Value: state
      }
    ],
  }
);
