exports.handler = function ( event, context, callback ) {
	
	context.done();

	callback( null, event.message );

}