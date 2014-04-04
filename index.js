
var _ = require( 'underscore' );
var $ = require( 'jquery' );
var Backbone = require( 'backbone' );
require( 'jquery-field-views' );
Backbone.$ = $;
Backbone.Subviews = require( 'backbone-subviews' );
Backbone.ViewOptions = require( 'backbone-view-options' );
Backbone.Handle = require( 'backbone-handle' );
// var kBaseFieldViewOptions = [ "name", "width" ];

module.exports = Backbone.View.extend( {
	className : "field-view",

	options : [ "name", "width" ],

	constructor : function( options ) {
		Backbone.View.prototype.constructor.apply( this, arguments );
		// Backbone.ViewOptions.add( this, "_onOptionsChanged" );
		Backbone.ViewOptions.add( this );
		this.setOptions( options );
		// this.options = _.union( _.result( this, "options" ) || [], kBaseFieldViewOptions );
		
		Backbone.Handle.add( this );
		Backbone.Subviews.add( this );
		
	},

	initialize: function( options ) {
		Backbone.View.prototype.initialize.apply( this, arguments );

		if( options ) this._value = options.value;

		if( _.isUndefined( this._value ) )
			this.resetValueToDefault();

		this._value = this._coerceToValidValue( this._value );

		this.on( "change", this._processValueChange, this );

		//this.listenTo( this.model, "change", this.render );  // no need for this, as of yet. also note if type changes, we need to change view class!
	},

	templateHelpers : function() {
		return this.getOptions();
	},

	render : function() {
		this.$el.html( this.template( this.getOptions() ) );
	},

	onRender : function() {
		this.$el.data( "view", this );
		this.$el.attr( "data-name", this.fieldName );

		if( this.width === "stretch" && _.isFunction( this.$el.stretch ) )
			this.$el.stretch();
		else if( ! _.isUndefined( this.width ) )
			this.$el.width( this.width - this.$el.paddingWidth() );
	},

	setValue : function( newValue, options ) {
		options = _.defaults( {}, options, {
			silent : false,
			/* pushValue is an internal option used by _processValueChange.  It is set to false when the
			 * new value and the coerced value are the same meaning that the value we pulled is the same
			 * as the value being stored so there is no need to push the value (usually means updating the UI isn't necessary)
			 */
			pushValue : true
		} );

		newValue = this._coerceToValidValue( newValue );
		if( _.isUndefined( newValue ) ) return false; // could not coerce to value valid

		var oldValue = this._value;
		this._value = newValue;

		if( this.$el.children().length > 0 ) {
			// don't push value if we have not yet rendered ourselves!
			if( options.pushValue ) this._pushValue( this._value );
		}

		if( ! options.silent && ! _.isEqual( oldValue, newValue ) ) {
			this.trigger( "change" );
		}

		// Process form errors if they have been processed previously.  It is important to call this after
		// the change event is spawned so that any changes made to the UI by other code in response to this change,
		// such as hiding or showing fields which can impact processFormErrors, are done before processFormErrors is called.
		if( this.formErrorsVisible )
			this.processFormErrors();

		return true;
	},

	getValue : function( options ) {
		options = _.defaults( {}, options, {
			immediate : false
		} );

		if( options.immediate ) return this._pullValue();
		else return this._value;
	},

	resetValueToDefault : function() {
		var newVal = _.isObject( this.defaultValue ) ? _.clone( this.defaultValue ) : this.defaultValue;

		this.setValue( newVal, { silent : false } );
	},

	processFormErrors : function() {
		return this.showFormErrors( this.getFormErrors() );
	},

	getFormErrors : function() {
		if( ! this.subviews )
			return null;

		var formErrors = [];
		var childFieldViews = this._getChildFieldViews();

		_.each( childFieldViews, function( thisFieldView ) {
			var childErrors = thisFieldView.getFormErrors();

			if( childErrors ) {
				formErrors.push( {
					type : "childFieldViewError",
					errors : childErrors,
					childFieldView : thisFieldView
				} );
			}
		} );

		if( formErrors.length > 0 )
			return formErrors;
		else
			return null;
	},

	showFormErrors : function( formErrors ) {
		this.formErrorsVisible = true;

		this.$el.toggleClass( "has-form-errors", !!formErrors );

		_.each( this._getChildFieldViews(), function( thisChildFieldView ) {
			thisChildFieldViewError = _.findWhere( formErrors, { type : "childFieldViewError", childFieldView : thisChildFieldView } );
			if( thisChildFieldViewError )
				thisChildFieldView.showFormErrors( thisChildFieldViewError.errors );
			else
				thisChildFieldView.showFormErrors( null );
		} );

		return formErrors;
	},

	_pullValue : function() {
		var childFieldViews = this._getChildFieldViews();

		var result = {};

		_.each( childFieldViews, function( thisChildFieldView ) {
			result[ thisChildFieldView.name ] = thisChildFieldView.getValue();
		} );

		return result;
	},

	_pushValue : function( value ) {
		var childFieldViews = this._getChildFieldViews();

		_.each( childFieldViews, function( thisChildFieldView ) {
			if( ! _.isUndefined( value[ thisChildFieldView.name ] ) )
				thisChildFieldView.setValue( value[ thisChildFieldView.name ] );
			else
				thisChildFieldView.resetValueToDefault();
		} );

	},

	_coerceToValidValue : function( newValue ) {
		return newValue; // override, return undefined if value no good!
	},

	_onOptionsChanged : function( changedOptions ) {
		// make sure our value is still valid!
		var newValue = this._coerceToValidValue( this._value );
		if( !_.isUndefined( newValue ) ) this.setValue( newValue );
		else this.resetValueToDefault();

		this.render();
	},

	onSubviewsRendered : function() {
		// _pushValue needs to go in onSubviewsRendered, in case additional ui decoration (like 
		// initializing jquery ui elements) is performed by descendant classes 
		// after calling parent's "onRender" function. If we just did _pushValue 
		// at the end of render() function, that logic would not yet be executed.

		this._pushValue( this._value );
	},

	_processValueChange : function() {
		var originalNewValue = this._pullValue();
		var coercedNewValue = this._coerceToValidValue( originalNewValue );
		
		if( _.isUndefined( coercedNewValue ) )
			// the value is invalid! revert the UI to our current value
			this._pushValue( this._value );
		else {
			var needToPushValueWithCoercedValue = ! _.isEqual( originalNewValue, coercedNewValue );
			this.setValue( coercedNewValue, { silent : false, pushValue : needToPushValueWithCoercedValue } );
		}
	},

	_getChildFieldViews : function( options ) {
		return _.values( this.$el.children().fieldViews( "find" ) );
	}
} );
