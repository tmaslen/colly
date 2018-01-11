const expect = require( "chai" ).expect;
const assert = require( "chai" ).assert;
const sinon  = require( "sinon" );
const fs     = require( "fs" );

const runLambda = require( "../lib/run-lambda" );

describe( "colly run-lambda", () => {

	it( "should fetch the correct event file", () => {

		process.env.COLLY__PROJECT_DIR = `./test`;
		process.env.COLLY__LAMBDA_EVENT_FILE = "fixtures/run-lambda/basicMessage.json";

		const expectedEvent = {
			"message": "Hello there"
		}

		expect( runLambda.getLambdaEventFile() ).to.deep.equal( expectedEvent );

	} );

	it( "should fetch the correct context file", ( done )=> {

		process.env.COLLY__PROJECT_DIR = `${process.cwd()}/test`;
		process.env.COLLY__LAMBDA_CONTEXT_FILE = "fixtures/run-lambda/basicContext.js";

		expect( runLambda.getLambdaContextFile().done() ).to.deep.equal( "contents of done function" );
		done();

	});

	it( "should work out whether to run the local or deployed version of the lambda", () => {

		process.env.COLLY__RUN_LAMBDA_LOCAL = "true";
		assert.isTrue( runLambda.runningLocally() );

		process.env.COLLY__RUN_LAMBDA_LOCAL = "false";
		assert.isNotTrue( runLambda.runningLocally() );

	} );

	it( "should run the lambda", ( done ) => {

		process.env.LAMBDA__ENV = "live";
		process.env.COLLY__LAMBDA_NAME = "myLambda";
		process.env.COLLY__PROJECT_DIR = `${process.cwd()}/test/fixtures/run-lambda`;
		process.env.COLLY__LAMBDA_EVENT_FILE = "basicMessage.json";

		runLambda.runLocally()
			.then( ( data ) => {

				expect( data ).to.equal( "Hello there" );
				done();

			})
			.catch( ( err ) => {
				console.log( err );
				assert.fail();
				done();
			})

	} );

});