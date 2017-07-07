const expect = require( "chai" ).expect;
const assert = require( "chai" ).assert;
const sinon  = require( "sinon" );
const AWS    = require( "aws-sdk" );
const utils  = require( "../lib/utils" );

const decryptVar = require( "../lib/decrypt-var" );

describe( "colly decrypt-var", () => {

	it( "should decrypt a var from the colly.json file", ( done ) => {

		// Create players
		const kms = new AWS.KMS();
		const stubbedDecrypt = sinon.stub( kms, "decrypt" );

		// Mock returns
		stubbedDecrypt.callsArgWith( 1, null, { "Plaintext": "bar" } );

		// Setup inputs
		process.env.ENV = "live";
		process.env.COLLY__PROJECT_DIR = "./test/fixtures/decrypt-var";

		// Assert
		decryptVar.decrypt( "foo", stubbedDecrypt )
			.then( ( data ) => {
				expect( data ).to.equal( "bar" );
				done();
			})
			.catch( ( err ) => {
				console.log( err );
				assert( false );
				done();
			});
		
		// Clean up
		stubbedDecrypt.restore();

	} );

});