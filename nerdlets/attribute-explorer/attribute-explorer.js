import React from 'react';
import { Layout, LayoutItem, PlatformStateContext, LineChart, HistogramChart, HeadingText, NrqlQuery, Grid, GridItem, BarChart,
  Dropdown, DropdownItem, Button, BlockText, Tile, navigation } from 'nr1'

const excludeAttributes = ["appId", "duration", "entityGuid", "entity.guid", "nr.guid", "timestamp", "totalTime", "databaseDuration",
    "externalDuration", "gcCumulative", "parent.transportDuration", "queueDuration", "totalTime", "webDuration", "duration.ms"];

export default class AttributeExplorer extends React.Component {
  constructor(props) {
    super(props);
    document.getElementById("root").style.backgroundColor = "rgb(241, 242, 242)";
    console.log(props);
    this.accountId = props.accountId;
    this.domain = props.domain;
    this.attributes = [];
    this.numberAttributes = [];
    this.booleanAttributes = [];
    this.eventTypes = ["Transaction", "TransactionError", "Span", "Span"];
    this.duration = ["duration", "duration", "duration", "duration.ms/1000"];
    this.currentEvent = 0;
    if (this.domain === "EXT") {
      this.currentEvent = 3;
    }
    this.guid = props.entityGuid;
    this.defaultTraceFilter = [{"attr":"entityGuid","operator":"EQ","value":this.guid}];
    this.traceFilter = this.defaultTraceFilter;
    this.metric = ["50th percentile", "75th percentile", "90th percentile", "99th percentile", "Average", "Count"];
    this.event = ["Transactions", "Errors", "Spans", "Spans(OTEL)"];
    this.attribWhere = "";
    this.currentMetric = 2;
    this.maxHistogram = 3;
    this.state = {
      headerCharts: [],
      charts: [],
      metric: this.metric[this.currentMetric],
      event: this.event[this.currentEvent],
    };
    this.getCharts(true);
  };

  async getHeaderCharts() {
    const errorNRQL = [", filter(count(*), WHERE error) as 'Errors'", "",
        ", filter(count(*), WHERE error.message IS NOT NULL OR error.class IS NOT NULL) as Errors",
        ", filter(count(*), WHERE otel.status_code = 'ERROR') as Errors"];
    const responseQuery = "SELECT percentile(" + this.duration[this.currentEvent] + ", 50, 75, 90, 99) as Duration, average(" + 
        this.duration[this.currentEvent] + ") as 'Avg duration' FROM " + this.eventTypes[this.currentEvent] + " WHERE entityGuid = '" + 
        this.guid + "'" + this.attribWhere + " TIMESERIES AUTO";
    const countQuery = "SELECT count(*) as 'Count'" + errorNRQL[this.currentEvent] + " FROM " +
        this.eventTypes[this.currentEvent] + " WHERE entityGuid = '" + this.guid + "'" + this.attribWhere + " TIMESERIES AUTO";
    const histogramQuery = "SELECT histogram(" + this.duration[this.currentEvent] + ", " + this.maxHistogram + ", 20) as Duration FROM " +
        this.eventTypes[this.currentEvent] + " WHERE entityGuid = '" + this.guid + "'" + this.attribWhere;
    let headerChartArray = [];
    headerChartArray.push(
      <GridItem columnSpan={5}><Tile type={Tile.TYPE.PLAIN} sizeType={Tile.SIZE_TYPE.SMALL}><HeadingText className="mySpaceBelow myHeader">Performance over time</HeadingText>
        <PlatformStateContext.Consumer>
          {
            (platformState) => {
              return <NrqlQuery
                accountIds={[this.accountId]}
                query={responseQuery}
                pollInterval={60000}
                timeRange={platformState.timeRange}
              >
              {
                ({data}) => {
                  return <LineChart data={data} fullWidth />;
                }
              }
              </NrqlQuery>
            }
          }
          </PlatformStateContext.Consumer>
      </Tile></GridItem>
    );
    headerChartArray.push(
      <GridItem columnSpan={4}><Tile type={Tile.TYPE.PLAIN} sizeType={Tile.SIZE_TYPE.SMALL}><HeadingText className="mySpaceBelow myHeader">Counts over time</HeadingText>
       <PlatformStateContext.Consumer>
          {
            (platformState) => {
              return <NrqlQuery
                accountIds={[this.accountId]}
                query={countQuery}
                pollInterval={60000}
                timeRange={platformState.timeRange}
              >
              {
                ({data}) => {
                  return <LineChart data={data} fullWidth />;
                }
              }
              </NrqlQuery>
            }
          }
          </PlatformStateContext.Consumer>
      </Tile></GridItem>
    );
    headerChartArray.push(
      <GridItem columnSpan={3}><Tile type={Tile.TYPE.PLAIN} sizeType={Tile.SIZE_TYPE.SMALL}><HeadingText className="mySpaceBelow myHeader">Response time histogram</HeadingText>
       <PlatformStateContext.Consumer>
          {
            (platformState) => {
              return <NrqlQuery
                accountIds={[this.accountId]}
                query={histogramQuery}
                pollInterval={60000}
                timeRange={platformState.timeRange}
              >
              {
                ({data}) => {
                  return <HistogramChart data={data} fullWidth />;
                }
              }
              </NrqlQuery>
            }
          }
          </PlatformStateContext.Consumer>
      </Tile></GridItem>
    );
    return headerChartArray;
  }

  async getCharts(getAttrib) {
    const attributeString = "ATTRIBUTE";
    const dur = this.duration[this.currentEvent];
    const values = ["percentile(" + dur + ", 50)", "percentile(" + dur + ", 75)", "percentile(" + dur + ", 90)",
      "percentile(" + dur + ", 99)", "average(" + dur + ")", "count(*)"];
    const chartQuery = "SELECT " + values[this.currentMetric] + " FROM " + this.eventTypes[this.currentEvent] +
      " WHERE entityGuid = '" + this.guid + "'" + this.attribWhere + " FACET " + attributeString;
    if (getAttrib) {
      await this.getAttributes();
      await this.get95Duration();
    }
    let chartsArray = [];
    for (let i = 0; i < this.attributes.length; i++) {
      chartsArray.push(<GridItem columnSpan={2}><Tile type={Tile.TYPE.PLAIN} sizeType={Tile.SIZE_TYPE.SMALL}>
        <div className="myHeader"><HeadingText type={HeadingText.TYPE.HEADING_5}>{this.attributes[i]}</HeadingText></div>
        <PlatformStateContext.Consumer>
          {
            (platformState) => {
              return <NrqlQuery
                accountIds={[this.accountId]}
                query={chartQuery.replace(attributeString, this.attributes[i])}
                pollInterval={60000}
                timeRange={platformState.timeRange}
              >
              {
                ({data}) => {
                  if (data != null && data.length > 0) {
                    //console.log(this.attributes[i]);
                    //console.log(data);
                    return <BarChart
                      data={data}
                      fullWidth
                      onClickBar={(evt) => this.setAttribute(this.attributes[i], evt.metadata.name)}
                    />;
                  }
                  else return <div className="myNoData">No values.</div>
                }
              }
              </NrqlQuery>
            }
          }
          </PlatformStateContext.Consumer>
        </Tile></GridItem>);
    }
    const header = await this.getHeaderCharts();
    this.setState({
      charts: chartsArray,
      metric: this.metric[this.currentMetric],
      event: this.event[this.currentEvent],
      headerCharts: header,
    });
  };

  getAttributesFromArray (attrib) {
    let attribArray = [];
    for (let i = 0; i < attrib.length; i++) {
      if (attribArray.indexOf(attrib[i]) < 0 && excludeAttributes.indexOf(attrib[i]) < 0) {
        attribArray.push(attrib[i]);
      }   
    }
    return attribArray;
  }

  async getAttributes() {
    const sampleQuery = "SELECT keyset() FROM " + this.eventTypes[this.currentEvent] + " WHERE entityGuid = '" + this.guid +
        "' SINCE 1 day ago";
    let attribArray = [];
    const res = await NrqlQuery.query({
      accountIds: [this.accountId],
      query: sampleQuery,
      formatType: NrqlQuery.FORMAT_TYPE.RAW});
    attribArray = this.getAttributesFromArray(res.data.results[0].allKeys);
    attribArray.sort(function(a, b){return a.toUpperCase().localeCompare(b.toUpperCase());});
    //console.log(attribArray);
    this.attributes = attribArray;
    this.numberAttributes = this.getAttributesFromArray(res.data.results[0].numericKeys);
    this.booleanAttributes = this.getAttributesFromArray(res.data.results[0].booleanKeys);
  };

  async get95Duration() {
    const durationQuery = "SELECT percentile(" + this.duration[this.currentEvent] + ", 95) FROM " + this.eventTypes[this.currentEvent] +
        " WHERE entityGuid = '" + this.guid + "'";
    const res = await NrqlQuery.query({
      accountIds: [this.accountId],
      query: durationQuery,
      formatType: NrqlQuery.FORMAT_TYPE.RAW});
    console.log(res);
    if (res.data.results.length > 0) {
      let dur = Number(res.data.results[0].percentiles[95]);
      if (dur > 1) {
        dur = Math.round(dur + Number.EPSILON + 0.5);
      } else if (dur > 0.1) {
        dur = Math.round(((dur + Number.EPSILON)*10) + 0.5)/10;
      }
      else {
        dur = Math.round(((dur + Number.EPSILON)*100) + 0.5)/100;
      }
      console.log(dur);
      this.maxHistogram = dur;
    }
  }

  async setAttribute(attrib, val) {
    let quote = "'";
    if (this.numberAttributes.indexOf(attrib) >= 0 || this.booleanAttributes.indexOf(attrib) >= 0) {
      quote = "";
    }
    const addWhere = " AND " + attrib + " = " + quote + val + quote;
    if (this.attribWhere.search(addWhere) < 0) {
      this.attribWhere = this.attribWhere + addWhere;
      if (this.booleanAttributes.indexOf(attrib) < 0) {
        this.traceFilter.push({"attr":attrib,"operator":"EQ","value":val});
      }
      else {
        this.traceFilter.push({"attr":attrib,"operator":val.toUpperCase(),"value":null});
      }
    }
    else {
      this.attribWhere = this.attribWhere.replace(addWhere, "");
      for (let i = 0; i < this.traceFilter.length; i++) {
        if (this.traceFilter[i].attr === attrib) {
          this.traceFilter.splice(i, 1);
        }
      }
    }
    console.log(this.traceFilter);
    this.getCharts(false);
  }

  async setMetric(metric) {
    this.currentMetric = metric;
    this.getCharts(false);
  }

  async setEvent(event) {
    this.currentEvent = event;
    this.getCharts(true);
  }

  async clearFilter() {
    this.attribWhere = "";
    this.traceFilter = this.traceFilter.slice(0, 1);
    console.log(this.traceFilter);
    this.getCharts(false);
  }

  async getTraces() {
    const nerdletState = {
      id: 'distributed-tracing-nerdlets.distributed-tracing-launcher',
      urlState: {"query":{"operator":"AND","indexQuery":{"conditionType":"INDEX","operator":"AND","conditions":[]},
          "spanQuery":{"operator":"AND","conditionSets":[{"conditionType":"SPAN","operator":"AND",
          "conditions":this.traceFilter}]}}},
    }
    console.log(this.traceFilter);
    navigation.openStackedNerdlet(nerdletState)
  }

  render() {
    const location1 = navigation.getOpenStackedNerdletLocation({id: "attribute-overlay"});
    const nerdlet = {
      id: 'distributed-tracing.home',
      "urlState": {
        "entityGuid": this.guid,
      },
    };
    //console.log(nerdlet);

    const location = navigation.getOpenStackedNerdletLocation(nerdlet);

    return (<div>
      <Layout>
        <LayoutItem>
          <div className="myBox"><Grid>{this.state.headerCharts}</Grid></div>
        </LayoutItem>
      </Layout>
      <Layout>
      <LayoutItem><div className="myBox"><Tile type={Tile.TYPE.PLAIN} sizeType={Tile.SIZE_TYPE.SMALL}>
        <BlockText className="myParameterBox" type={BlockText.TYPE.NORMAL}>
          <span className="mySpaceRight">Currently displaying:</span>
          <Dropdown iconType={Dropdown.ICON_TYPE.DATAVIZ__DATAVIZ__BAR_CHART} title={this.state.metric} className="mySpaceRight">
            <DropdownItem onClick={(evt0) => this.setMetric(0)}>{this.metric[0]}</DropdownItem>
            <DropdownItem onClick={(evt1) => this.setMetric(1)}>{this.metric[1]}</DropdownItem>
            <DropdownItem onClick={(evt2) => this.setMetric(2)}>{this.metric[2]}</DropdownItem>
            <DropdownItem onClick={(evt3) => this.setMetric(3)}>{this.metric[3]}</DropdownItem>
            <DropdownItem onClick={(evt4) => this.setMetric(4)}>{this.metric[4]}</DropdownItem>
            <DropdownItem onClick={(evt5) => this.setMetric(5)}>{this.metric[5]}</DropdownItem>
          </Dropdown>
          {this.domain === "APM" &&
            <span className="mySpaceRight">of:
              <Dropdown iconType={Dropdown.ICON_TYPE.DATAVIZ__DATAVIZ__TABLE_CHART} title={this.state.event} className="mySpaceRight">
                <DropdownItem onClick={() => this.setEvent(0)}>{this.event[0]}</DropdownItem>
                <DropdownItem onClick={() => this.setEvent(1)}>{this.event[1]}</DropdownItem>
                <DropdownItem onClick={() => this.setEvent(2)}>{this.event[2]}</DropdownItem>
              </Dropdown>
            </span>
          }
          Number of attributes: {this.attributes.length}
          <Button onClick={() => this.getTraces()} className="mySpaceLeft" iconType={Button.ICON_TYPE.HARDWARE_AND_SOFTWARE__SOFTWARE__TRACES}>Traces</Button>
          <div className="mySpaceTop">
            <Button iconType={Button.ICON_TYPE.INTERFACE__OPERATIONS__FILTER__A_REMOVE} onClick={() => this.clearFilter()} className="mySpaceRight">Clear filter</Button>
            <span className="mySpaceRight">Current filter:{this.attribWhere.replace(/AND/, "")}</span>
          </div>
        </BlockText>
      </Tile></div></LayoutItem>
      </Layout>
      <Layout>
        <LayoutItem>
            <div className="myBox"><Grid>{this.state.charts}</Grid></div>
        </LayoutItem>
      </Layout>
    </div>);
  }
}
