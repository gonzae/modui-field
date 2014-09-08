
var _ = require( 'underscore' );
var BaseView = require( 'modui-base' );
var $ = require( 'jquery' );

var FieldView;

module.exports = FieldView = BaseView.extend( {
	className : 'modui-field',

	options : [ 'name', 'width' ],

	initialize: function( options ) {
		BaseView.prototype.initialize.apply( this, arguments );

		if( options ) this._value = options.value;

		if( _.isUndefined( this._value ) )
			this._resetValueToDefault();

		this._value = this._coerceToValidValue( this._value );
	},

	render : function() {
		BaseView.prototype.render.apply( this, arguments );
		
		this.$el.data( 'view', this );
		this.$el.attr( 'data-name', this.fieldName );

		if( this.width === 'stretch' && _.isFunction( this.$el.stretch ) )
			this.$el.stretch();
		else if( ! _.isUndefined( this.width ) )
			this.$el.width( this.width - ( this.$el.innerWidth() - this.$el.width() ) );
	},

	setValue : function( newValue, options ) {
		options = _.defaults( {}, options, {
			silent : false,
			// pushValue is an internal option used by _processValueChange.  It is set to false when the
			// new value and the coerced value are the same meaning that the value we pulled is the same
			// as the value being stored so there is no need to push the value (usually means updating the UI isn't necessary)
			pushValue : true
		} );

		newValue = this._coerceToValidValue( newValue );
		if( _.isUndefined( newValue ) ) return false; // could not coerce to value valid

		var oldValue = this._value;
		this._value = newValue;

		if( this.$el.children().length > 0 )
			// don't push value if we have not yet rendered ourselves!
			if( options.pushValue ) this._pushValue( this._value );

		if( ! options.silent && ! _.isEqual( oldValue, newValue ) )
			this.spawn( 'change' );

		// Once we have already attempted a submit for this field view, we update the ui for displayed form errors
		// as soon as the value changes from then on. That way people see when they have corrected their
		// mistakes, and the mistakes will appear immediately if they are re-done. It is important to do this after
		// the change event is spawned so that any changes made to the UI by other code in response to this change,
		// such as hiding or showing fields which can impact form errors, are done before we do it.
		if( this.submitAttempted ) {
			this.$el.removeClass( "submit-just-attempted" );
			this.showFormErrors( this.getFormErrors() );
		}

		return true;
	},

	getValue : function( options ) {
		options = _.defaults( {}, options, {
			immediate : false
		} );

		if( options.immediate ) return this._coerceToValidValue( this._pullValue() );
		else return this._value;
	},

	processFormErrors : function() {
		return this.showFormErrors( this.getFormErrors() );
	},

	getFormErrors : function( options ) {
		return [];
	},

	showFormErrors : function( formErrors ) {
		this.$el.toggleClass( "has-form-errors", formErrors.length > 0 );
	},

	attemptSubmit : function() {
		var _this = this;
		
		var canSubmit = true;

		var childFieldViews = this._getChildFieldViews();
		_.each( childFieldViews, function( thisFieldView ) {
			if( ! thisFieldView.attemptSubmit() ) canSubmit = false;
		} );

		var formErrors = this.getFormErrors();
		this.showFormErrors( formErrors );
		if( formErrors.length ) canSubmit = false;

		this.$el.removeClass( "submit-just-attempted" );
		_.defer( function() { _this.$el.addClass( "submit-just-attempted" ); } );

		this.submitAttempted = true;

		return canSubmit;
	},

	_resetValueToDefault : function() {
		var newVal = _.isObject( this.defaultValue ) ? _.clone( this.defaultValue ) : this.defaultValue;

		this.setValue( newVal, { silent : false } );
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
				thisChildFieldView._resetValueToDefault();
		} );
	},

	_coerceToValidValue : function( newValue ) {
		return newValue; // override, return undefined if value no good!
	},

	_onOptionsChanged : function( changedOptions ) {
		// make sure our value is still valid!
		var newValue = this._coerceToValidValue( this._value );
		if( !_.isUndefined( newValue ) ) this.setValue( newValue );
		else this._resetValueToDefault();

		this.render();
	},

	_onSubviewsRendered : function() {
		// _pushValue needs to go in _onSubviewsRendered, in case additional ui decoration (like 
		// initializing jquery ui elements) is performed by descendant classes 
		// after calling parent's 'onRender' function. If we just did _pushValue 
		// at the end of render() function, that logic would not yet be executed.

		if( ! _.isUndefined( this._value ) )
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
		return _.values( FieldView.find( this.$el.children() ) );
	},

	_renderTemplate : function( templateData ) {
		// kind of a hack to let us use both underscore and nunjucks. should probably
		// put this in our base view mixin, once we change base view to be a mixin, that is
		this.$el.html( this.template.render ? this.template.render( templateData ) : this.template( templateData ) );
	}
}, {
	find : function( els, options ) {
		var viewElements = els.filter( '.modui-field' );
		viewElements = viewElements.add( els.find( '.modui-field' ) );

		options = _.extend( {
			includeHiddenViews : false,
			excludeUnavailableDependents : true
		}, options );

		if( ! options.includeHiddenViews ) viewElements = viewElements.filter( ':visible' );

		// get rid of 'sub-modui-fields'.. that is, do not include field views that are children of other field views
		var newViewElements = $( viewElements );
		viewElements.each( function() {
			newViewElements = newViewElements.not( $( this ).find( '.modui-field' ) );
		} );
		viewElements = newViewElements;

		var fieldViews = [];
		var fieldViewsToExclude = [];

		viewElements.each( function() {
			var thisViewEl = $( this );
			var thisFieldViewObject = thisViewEl.data( 'view' );
			if( thisFieldViewObject === undefined || ! thisFieldViewObject instanceof Object ) return false;

			fieldViews.push( thisFieldViewObject );

			if( options.excludeUnavailableDependents &&
				_.isFunction( thisFieldViewObject.getDependentFieldViews ) &&
				thisFieldViewObject.getValue() === false )
					_.each( thisFieldViewObject.getDependentFieldViews(), function( thisDependentFieldView ) {
						fieldViewsToExclude.push( thisDependentFieldView );
					} );
		} );

		fieldViews = _.difference( fieldViews, fieldViewsToExclude );

		return fieldViews;
	},

	get : function( els, options ) {
		options = _.extend( {
			includeHiddenViews : false,
			excludeUnavailableDependents : true
		}, options );

		var fieldViews = FieldView.find( els, options );
		var valueHash = {};

		for( var i = 0, len = fieldViews.length; i < len; i++ ) {
			var thisFieldView = fieldViews[ i ];
			var thisFieldViewIdent = thisFieldView.name;
			valueHash[ thisFieldViewIdent ] = thisFieldView.getValue();
		}

		return valueHash;
	},

	set : function( els, suppliedValues, options ) {
		if( suppliedValues === undefined ) throw new Error( 'Undefined hash of values to use for setFields.' );

		options = _.extend( {
			includeHiddenViews : false,
			resetUnsuppliedValuesToDefaults : true,
			excludeUnavailableDependents : false	// otherwise we might exclude a dependent based on the current value of its 'parent', but we may be changing that value!
		}, options );

		var fieldViews = FieldView.find( els, options );

		for( var i = 0, len = fieldViews.length; i < len; i++ ) {
			var thisFieldView = fieldViews[ i ];
			var thisFieldViewIdent = thisFieldView.name;
			var newValue = suppliedValues[ thisFieldViewIdent ];

			if( newValue === undefined &&
				options.resetUnsuppliedValuesToDefaults )
			{
				thisFieldView._resetValueToDefault();
			}

			if( newValue !== undefined )
				thisFieldView.setValue( newValue );
		}
	}
} );

$.fn.fieldViews = function( action ) {
	var args = Array.prototype.slice.call( arguments, 1 );
	args.unshift( this );

	var actions = {
		get : FieldView.get,
		set : FieldView.set,
		find : FieldView.find
	};

	return actions[ action ].apply( this, args );
};
