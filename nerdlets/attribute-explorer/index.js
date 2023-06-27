import React from 'react';
import { NerdletStateContext, EntityByGuidQuery, Spinner, StackItem, SectionMessage } from 'nr1';
import AttributeExplorer from './attribute-explorer';

export default class AttributeExplorerNerdlet extends React.PureComponent {
  constructor(props) {
    super(props);
  }

  getEntityGuid(nerd) {
    if (nerd.hasOwnProperty('entityGuid')) {
      console.log(nerd);
      return nerd.entityGuid;
    }
    else {
      return null;
    }
  }

  render() {
    return (
      <NerdletStateContext.Consumer>
        {(nerdletState) => 
          <EntityByGuidQuery entityGuid={this.getEntityGuid(nerdletState)}>
            {({ loading, error, data }) => {
              if (loading) {
                return <Spinner />;
              }

              if (error) {
                return (
                  <StackItem>
                    <SectionMessage
                     type={SectionMessage.TYPE.CRITICAL}
                     title="Error in lauching the app."
                      description={error.message}
                    />
                 </StackItem>
                );
              }

              if (data.entities.length === 0) {
                return (
                  <StackItem>
                    <SectionMessage
                      description="No service found, please launch the app from within an APM or OTEL service."
                    />
                  </StackItem>
                );
              }

              return (
                <AttributeExplorer
                  entityGuid={this.getEntityGuid(nerdletState)}
                  entityName={data.entities[0].name}
                  accountId={data.entities[0].accountId}
                  domain={data.entities[0].domain}
                  type={data.entities[0].type}
                />
              );
            }}
          </EntityByGuidQuery>
        }
      </NerdletStateContext.Consumer>
    );
  }
}
