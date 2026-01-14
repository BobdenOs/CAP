sap.ui.define([
  "sap/gantt/library"
], function (GanttLibrary) {
  "use strict";

  var TimeUnit = GanttLibrary.config.TimeUnit;

  var oProportionTimeLineOptions = {
    "50Milliseconds": {
      innerInterval: {
        unit: TimeUnit.millisecond,
        span: 50,
        range: 90,
        selector: function (diff) {
          return diff >= 35;
        }
      },
      largeInterval: {
        unit: TimeUnit.second,
        span: 1,
        pattern: "ha / HH:mm:ss"
      },
      smallInterval: {
        unit: TimeUnit.millisecond,
        span: 50,
        pattern: "SSS"
      }
    },
    "100Milliseconds": {
      innerInterval: {
        unit: TimeUnit.millisecond,
        span: 100,
        range: 90,
        selector: function (diff) {
          return diff >= 30;
        }
      },
      largeInterval: {
        unit: TimeUnit.second,
        span: 1,
        pattern: "ha / HH:mm:ss"
      },
      smallInterval: {
        unit: TimeUnit.millisecond,
        span: 100,
        pattern: "SSS"
      }
    },
    "500Milliseconds": {
      innerInterval: {
        unit: TimeUnit.millisecond,
        span: 500,
        range: 90,
        selector: function (diff) {
          return diff >= 60;
        }
      },
      largeInterval: {
        unit: TimeUnit.second,
        span: 1,
        pattern: "ha / HH:mm:ss"
      },
      smallInterval: {
        unit: TimeUnit.millisecond,
        span: 500,
        pattern: "SSS"
      }
    },
    "1seconds": {
      innerInterval: {
        unit: TimeUnit.second,
        span: 1,
        range: 90,
        selector: function (diff) {
          return diff >= 25;
        }
      },
      largeInterval: {
        unit: TimeUnit.minute,
        span: 1,
        pattern: "ha / HH:mm"
      },
      smallInterval: {
        unit: TimeUnit.second,
        span: 1,
        pattern: "ss"
      }
    },
    "5seconds": {
      innerInterval: {
        unit: TimeUnit.second,
        span: 5,
        range: 90,
        selector: function (diff) {
          return diff >= 45;
        }
      },
      largeInterval: {
        unit: TimeUnit.minute,
        span: 1,
        pattern: "ha / HH:mm"
      },
      smallInterval: {
        unit: TimeUnit.second,
        span: 5,
        pattern: "ss"
      }
    },
    "15seconds": {
      innerInterval: {
        unit: TimeUnit.second,
        span: 15,
        range: 90,
        selector: function (diff) {
          return diff >= 35;
        }
      },
      largeInterval: {
        unit: TimeUnit.minute,
        span: 1,
        pattern: "ha / HH:mm"
      },
      smallInterval: {
        unit: TimeUnit.second,
        span: 15,
        pattern: "ss"
      }
    },
    "30seconds": {
      innerInterval: {
        unit: TimeUnit.second,
        span: 30,
        range: 90,
        selector: function (diff) {
          return diff >= 60;
        }
      },
      largeInterval: {
        unit: TimeUnit.minute,
        span: 1,
        pattern: "ha / HH:mm"
      },
      smallInterval: {
        unit: TimeUnit.second,
        span: 30,
        pattern: "ss"
      }
    },
    "1min": {
      innerInterval: {
        unit: TimeUnit.minute,
        span: 1,
        range: 90,
        selector: function (diff) {
          return diff >= 90;
        }
      },
      largeInterval: {
        unit: TimeUnit.hour,
        span: 1,
        pattern: "ha / HH"
      },
      smallInterval: {
        unit: TimeUnit.minute,
        span: 1,
        pattern: "mm"
      }
    }
  }

  return {
    duration(start, end) {
      if (start && end) return new Date(end).getTime() - new Date(start).getTime()
      return 0
    },

    color(domain, server) {
      const src = domain + '@' + server
      let a = 0
      for (let i = 0; i < src.length; i++) a = (src.charCodeAt(i) + ((a << 5) - a))
      return `#${(a & 0xffffff).toString(16).padStart(6, '0')}`
    },

    onloaded(event) {
      var gantt = event.getSource()
      gantt.setBusy(true)
      if (gantt.getCustomData()[0].getBinding('value')) {
        gantt.getCustomData()[0].getBinding('value').attachChange(function (event) {
          const correlation = event.getSource().getValue()
          const table = gantt.getGanttCharts()[0].getTable()
          const rows = table.getBinding('rows')
          rows.filter(new sap.ui.model.Filter("correlation", sap.ui.model.FilterOperator.EQ, correlation))
          rows.attachChange(function (event) {
            const time = gantt.getGanttCharts()[0].getAxisTimeStrategy()

            const { start, end } = event.getSource().getContexts().reduce((ret, ctx) => {
              const obj = ctx.getObject()
              const start = new Date(obj.start)
              const end = new Date(obj.end)
              if (!ret.start || ret.start > start) ret.start = start
              if (!ret.end || ret.end < end) ret.end = end
              return ret
            }, {})

            time.setTimeLineOptions(oProportionTimeLineOptions)
            time.setTimeLineOption(oProportionTimeLineOptions["30seconds"])

            time.setCoarsestTimeLineOption(oProportionTimeLineOptions["1min"])
            time.setFinestTimeLineOption(oProportionTimeLineOptions["50Milliseconds"])

            start.setMilliseconds(start.getMilliseconds() - 200)
            end.setMilliseconds(end.getMilliseconds() + 200)

            time.getTotalHorizon().setStartTime(start)
            time.getTotalHorizon().setEndTime(end)

            time.getVisibleHorizon().setStartTime(start)
            time.getVisibleHorizon().setEndTime(end)

            gantt.rerender()
            gantt.setBusy(false)
          })
        })
      }
    }
  }
})
