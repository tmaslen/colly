const expect = require( "chai" ).expect;
const assert = require( "chai" ).assert;
const AWS    = require( "aws-sdk" );
const sinon  = require( "sinon" );

process.env.LAMBDA__ENV = "live";
const utils = require( "../lib/utils" );
const createLambda = require( "../lib/deploy-lambda/createLambda" );
const updateLambda = require( "../lib/deploy-lambda/updateLambda" );
const scheduledEvent = require( "../lib/deploy-lambda/scheduledEvent" );

describe( "colly deploy-lambda", () => {

	describe( "updateLambda.js", () => {

		describe( "configShouldBeUpdated function, Environment variables", () => {


			it( "Should return FALSE when there are no environment variables", () => {

				const projectConfig = {};
				const deployedConfig = {};

				expect( updateLambda.configShouldBeUpdated( {}, projectConfig, deployedConfig ) ).to.equal( false );

			});

			it( "Should return TRUE when there are new environment variables", () => {

				const projectConfig = {
					"environmentVariables": {
						"foo": "bar"
					}
				};
				const deployedConfig = {};

				expect( updateLambda.configShouldBeUpdated( {}, projectConfig, deployedConfig ) ).to.equal( true );

			});

			it( "Should return TRUE when there are changes to environment variables", () => {

				const projectConfig = {
					"environmentVariables": {
						"foo": "bar",
						"lar": "car"
					}
				};
				const deployedConfig = {
					"Environment": {
						"Variables": {
							"foo": "bar"
						}
					}
				};

				expect( updateLambda.configShouldBeUpdated( {}, projectConfig, deployedConfig ) ).to.equal( true );

			});

			it( "Should return TRUE when removing environment variables", () => {

				const projectConfig = {};
				const deployedConfig = {
					"Environment": {
						"Variables": {
							"foo": "bar"
						}
					}
				};

				expect( updateLambda.configShouldBeUpdated( {}, projectConfig, deployedConfig ) ).to.equal( true );

			});

		});

		describe( "--dryrun option when updating", () => {

			let dryRun;
			let wetRun;

			beforeEach( () => {

				dryRun = sinon.stub( updateLambda, "dryRun" );
				dryRun.returns( "DRY RUN" );
				wetRun = sinon.stub( updateLambda, "wetRun" );
				wetRun.returns( "WET RUN" );

			});


			afterEach( () => {

				dryRun.restore();
				wetRun.restore();

			});

			it( "Should have the default behaviour of deploying to AWS", () => {

				updateLambda.init();
				expect( dryRun.called ).to.equal( false );
				expect( wetRun.called ).to.equal( true );

			});

			it( "Should perform a dry run when the `--dryrun` option is TRUE", () => {

				process.env.COLLY__DRY_RUN = true;
				updateLambda.init();
				expect( dryRun.called ).to.equal( true );
				expect( wetRun.called ).to.equal( false );

			});

			it( "Should NOT perform a dry run when the `--dryrun` option is FALSE", () => {

				process.env.COLLY__DRY_RUN = false;
				updateLambda.init();
				expect( dryRun.called ).to.equal( false );
				expect( wetRun.called ).to.equal( true );

			});

		});

		describe( "--dryrun option when creating", () => {

			let dryRun;
			let wetRun;

			beforeEach( () => {

				dryRun = sinon.stub( createLambda, "dryRun" );
				dryRun.returns( "DRY RUN" );
				wetRun = sinon.stub( createLambda, "wetRun" );
				wetRun.returns( "WET RUN" );

			});


			afterEach( () => {

				dryRun.restore();
				wetRun.restore();

			});

			it( "Should have the default behaviour of deploying to AWS", () => {

				createLambda.init();
				expect( dryRun.called ).to.equal( false );
				expect( wetRun.called ).to.equal( true );

			});

			it( "Should perform a dry run when the `--dryrun` option is TRUE", () => {

				process.env.COLLY__DRY_RUN = true;
				createLambda.init();
				expect( dryRun.called ).to.equal( true );
				expect( wetRun.called ).to.equal( false );

			});

			it( "Should NOT perform a dry run when the `--dryrun` option is FALSE", () => {

				process.env.COLLY__DRY_RUN = false;
				createLambda.init();
				expect( dryRun.called ).to.equal( false );
				expect( wetRun.called ).to.equal( true );

			});

		});

	});

});