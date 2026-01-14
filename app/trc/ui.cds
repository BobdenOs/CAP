using sap.cap.trc.traces from '@cap-community/cap/srv/trc';

////////////////////////////////////////////////////////////////////////////
//
//	Books Object Page
//
annotate traces with @(
  Common.SemanticKey: [ID],
  UI                : {
    Identification : [{Value: name}],
    HeaderInfo     : {
      TypeName      : '{i18n>trace}',
      TypeNamePlural: '{i18n>traces}',
      Description   : {Value: name},
    },

    SelectionFields: [correlation],

    HeaderFacets   : [],

    Facets         : [],

    LineItem       : [
      {
        Value             : (correlation),
        @HTML5.CssDefaults: {width: '300px'}
      },
      {
        Value             : (domain),
        @HTML5.CssDefaults: {width: '140px'}
      },
      {
        Value             : (name),
        @HTML5.CssDefaults: {width: 'auto'},
        @UI.Importance    : #High
      },
      {Value: (start)},
      {Value: (end)},
      {Value: (server)},
    ],

  }
);

annotate traces {
  ID          @(Common: {
    SemanticObject : 'Books',
    Text           : name,
    TextArrangement: #TextOnly
  });
  correlation @(
    HTML5.CssDefaults: {width: '300px'},
    Common.ValueList : {
      Label         : 'Correlation',
      CollectionPath: 'traces',
      Parameters    : [{
        $Type            : 'Common.ValueListParameterInOut',
        LocalDataProperty: correlation,
        ValueListProperty: 'correlation',
      }]
    }
  );
};
