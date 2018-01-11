const expect = require( "chai" ).expect;
const assert = require( "chai" ).assert;
const sinon  = require( "sinon" );
const AWS    = require( "aws-sdk" );
const utils  = require( "../lib/utils" );

const encryptVar = require( "../lib/encrypt-var" );

describe( "colly encrypt-var", () => {

	it( "should encrypt a var passed to it", () => {

		// Create players
		const kms = new AWS.KMS();
		const stubbedEncrypt = sinon.stub( kms, "encrypt" );
		const stubbedAddEnvVarToProjectConfig = sinon.stub( utils, "addEnvVarToProjectConfig" );
		const expectedKmsArg = {
			"KeyId": "arn:aws:kms:eu-west-1:550213415212:key/55e324f3-218f-46e2-a177-a1b04c3f6cbc",
			"Plaintext": "bar"
		};

		// Mock returns
		stubbedEncrypt.callsArgWith( 1, null, { "CiphertextBlob": "encryptedBar" } );

		// Setup inputs
		process.env.LAMBDA__ENV = "live";
		process.env.COLLY__PROJECT_DIR = "./test/fixtures/encrypt-var";

		// Run method
		encryptVar.encrypt( "foo", "bar", stubbedEncrypt );

		// Assert
		expect( stubbedEncrypt.getCall( 0 ).args[ 0 ] ).to.deep.equal( expectedKmsArg );
		expect( stubbedAddEnvVarToProjectConfig.getCall( 0 ).args[ 0 ] ).to.equal( "foo" );
		expect( stubbedAddEnvVarToProjectConfig.getCall( 0 ).args[ 1 ] ).to.equal( "encryptedBar" );

		// Clean up
		stubbedEncrypt.restore();
		stubbedAddEnvVarToProjectConfig.restore();

	} );

});