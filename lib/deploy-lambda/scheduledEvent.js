const AWS = require( "aws-sdk" );

const utils = require( "../utils" );
const createIamRole = require( "../utils/createIamRole" );

const cloudwatchevents = new AWS.CloudWatchEvents();

function createRole ( state ) {
  return new Promise ( ( resolve, reject ) => {

    createIamRole( "rule", "", null )
      .then( ( ruleRoleArn ) => {
        state.ruleRoleArn = ruleRoleArn;
        resolve( state );
      })
      .catch( reject );

  });
}

function setRule ( state ) {
  return new Promise ( ( resolve, reject ) => {
    
    const ruleName = state.ruleName || `${state.lambdaName}Rule`;
    const scheduledExpression = `rate(5 minutes)`;

    let params = {
      Name: ruleName,
      ScheduleExpression: state.eventSchedule
    };

    if ( state.lambdaName ) {
      params.Description = `Scheduled event for the lambda ${state.lambdaName}`;
    }

    if ( state.roleArn ) {
      params.RoleArn = state.roleArn;
    }

    cloudwatchevents.putRule( params, function(err, data) {
      if ( err ) {
        reject( err );
        return;
      }
      state.ruleName = ruleName;
      state.ruleArn = data.RuleArn;
      resolve( state );
    });

  });
}

function createTarget ( state ) {
  return new Promise ( ( resolve, reject ) => {
  
    var params = {
      Rule: state.ruleName,
      Targets: [{
        "Id": `${state.ruleName}-1`, 
        "Arn": state.lambdaArn
      }]
    };
    cloudwatchevents.putTargets( params, function(err, data) {
      if ( err ) {
        reject( err );
        return;
      }
      resolve( state );
    });

  });
}

function removeTarget ( state ) {
  return new Promise ( ( resolve, reject ) => {
  
    var params = {
      Rule: state.ruleName,
      Ids: [ `${state.ruleName}-1` ]
    };
    cloudwatchevents.removeTargets( params, function(err, data) {
      if ( err ) {
        reject( err );
        return;
      }
      resolve( state );
    });

  });
}

function addPermissionToLambda ( state ) {
  return new Promise( ( resolve, reject ) => {

    const lambda = new AWS.Lambda();

    const params = {
      "Action": "lambda:InvokeFunction",
      "FunctionName": state.lambdaName,
      "Principal": "events.amazonaws.com",
      "StatementId": "ID-1",
      "SourceArn": state.ruleArn
    };
    lambda.addPermission( params, ( err, data ) => {
      if ( err ){
        reject( err );
        return;
      } 

      resolve( state );

    });

  });
}

function removeRule ( state ) {
  return new Promise( ( resolve, reject ) => {
    const params = {
      "Name": state.ruleName
    };

    cloudwatchevents.deleteRule( params, ( err ) => {
      if ( err ) {
        reject( err );
        return;
      }
      resolve( state );
    });
  });
}

function removePermissionFromLambda( state ) {
  return new Promise( ( resolve, reject ) => {

    const lambda = new AWS.Lambda();

    const params = {
      "FunctionName": state.lambdaName, 
      "StatementId": "ID-1"
    };

    lambda.removePermission( params, ( err ) => {
      if ( err ) {
        reject( err );
        return;
      }
      resolve( state );
    });

  });
}

function createScheduledEvent ( lambdaArn, lambdaName, eventSchedule ) {
  return new Promise ( ( resolve, reject ) => {

    console.log( "creating scheduled event..." );

    let state = {
      "lambdaArn": lambdaArn,
      "lambdaName": lambdaName,
      "eventSchedule": eventSchedule
    };

    setRule( state )
      .then( createTarget )
      .then( addPermissionToLambda )
      .then( ( state ) => {
        return new Promise( ( resolve ) => {
          if ( "ruleName" in state ) {
            utils.addValueToLambdaConfig( `deployedAssets.${process.env.ENV}.ruleArn`, state.ruleName );
          }
          resolve();
        });
      })
      .then( resolve )
      .catch( reject );

  });
}

function updateScheduledEvent ( ruleName, eventSchedule ) {
  return new Promise ( ( resolve, reject ) => {

    console.log( "updating schedule" );

    const state = {
      "ruleName": ruleName,
      "eventSchedule": eventSchedule
    };

    setRule( state )
      .then( resolve )
      .catch( reject );

  });
}

function removeScheduledEvent ( ruleName, lambdaName ) {
  return new Promise ( ( resolve, reject ) => {

    console.log( "removing schedule" );

    const state = {
      "ruleName": ruleName,
      "lambdaName": lambdaName
    };

    removePermissionFromLambda( state )
      .then( removeTarget )
      .then( removeRule )
      .then( ( state ) => {
        return new Promise( ( resolve ) => {
          utils.removeValueFromLambdaConfig( `deployedAssets.${process.env.ENV}.ruleArn` );
          resolve();
        });    
      })
      .then( resolve )
      .catch( reject );

  });
}

function init () {

  return new Promise( ( resolve, reject ) => {

    const config = utils.getLambdaConfigFile();

    const ruleArn = utils.getValueFromLambdaConfig( `deployedAssets.${process.env.ENV}.ruleArn` );

    const lambdaArnValue = utils.getValueFromLambdaConfig( `deployedAssets.${process.env.ENV}.${utils.getLambdaName()}Arn` ) ||  utils.getValueFromLambdaConfig( `deployedAssets.${process.env.ENV}.lambdaArn` );

    if ( "eventSchedule" in config && ruleArn == undefined ) {
      createScheduledEvent( lambdaArnValue, config.name, config.eventSchedule )
        .then( resolve )
        .catch( reject );
    }

    if ( "eventSchedule" in config && ruleArn != undefined ) {
      updateScheduledEvent( ruleArn, config.eventSchedule )
        .then( resolve )
        .catch( reject );
    }

    if ( config.eventSchedule == undefined && ruleArn != undefined ) {
      removeScheduledEvent( ruleArn, config.name )
        .then( resolve )
        .catch( reject );
    }

  });

}

module.exports = {
  "init": init
}


