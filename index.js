
var _ = require( 'underscore' );
var baseView = require( 'modui-base' );

module.exports = FieldView = baseView.extend( {
	className : 'field-view',

	options : [ 'name', 'width' ],

	initialize: function( options ) {
		baseView.prototype.initialize.apply( this, arguments );

		if( options ) this._value = options.value;

		if( _.isUndefined( this._value ) )
			this.resetValueToDefault();

		this._value = this._coerceToValidValue( this._value );

		this.on( 'change', this._processValueChange, this );
	},

	render : function() {
		this.$el.html( this.template( this.getOptions() ) );

		this.$el.data( 'view', this );
		this.$el.attr( 'data-name', this.fieldName );

		if( this.width === 'stretch' && _.isFunction( this.$el.stretch ) )
			this.$el.stretch();
		else if( ! _.isUndefined( this.width ) )
			this.$el.width( this.width - this.$el.paddingWidth() );
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
			this.trigger( 'change' );

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
					type : 'childFieldViewError',
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

		this.$el.toggleClass( 'has-form-errors', !!formErrors );

		_.each( this._getChildFieldViews(), function( thisChildFieldView ) {
			thisChildFieldViewError = _.findWhere( formErrors, { type : 'childFieldViewError', childFieldView : thisChildFieldView } );
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

	_onSubviewsRendered : function() {

		this.onRender();
		// _pushValue needs to go in onSubviewsRendered, in case additional ui decoration (like 
		// initializing jquery ui elements) is performed by descendant classes 
		// after calling parent's 'onRender' function. If we just did _pushValue 
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
		return _.values( this.$el.children().fieldViews( 'find' ) );
	}
}, {
	find : function( els, options ) {
		var viewElements = els.filter( '.field-view' );
		viewElements = viewElements.add( els.find( '.field-view' ) );

		options = $.extend( {
			includeHiddenViews : false,
			excludeUnavailableDependents : true
		}, options );

		if( ! options.includeHiddenViews ) viewElements = viewElements.filter( ':visible' );

		// get rid of 'sub-field-views'.. that is, do not include field views that are children of other field views
		var newViewElements = $( viewElements );
		viewElements.each( function() {
			newViewElements = newViewElements.not( $( this ).find( '.field-view' ) );
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

	get : function( options ) {
		options = $.extend( {
			includeHiddenViews : false,
			excludeUnavailableDependents : true
		}, options );

		var $this = $( this );
		var fieldViews = FieldView.find( $this, options );
		var valueHash = {};

		for( var i = 0, len = fieldViews.length; i < len; i++ ) {
			var thisFieldView = fieldViews[ i ];
			var thisFieldViewIdent = thisFieldView.name;
			valueHash[ thisFieldViewIdent ] = thisFieldView.getValue();
		}

		return valueHash;
	},

	set : function( suppliedValues, options ) {
		if( suppliedValues === undefined ) throw new Error( 'Undefined hash of values to use for setFields.' );

		options = $.extend( {
			includeHiddenViews : false,
			resetUnsuppliedValuesToDefaults : true,
			excludeUnavailableDependents : false	// otherwise we might exclude a dependent based on the current value of its 'parent', but we may be changing that value!
		}, options );

		var $this = $( this );
		var fieldViews = FieldView.find( $this, options );

		for( var i = 0, len = fieldViews.length; i < len; i++ ) {
			var thisFieldView = fieldViews[ i ];
			var thisFieldViewIdent = thisFieldView.name;
			var newValue = suppliedValues[ thisFieldViewIdent ];

			if( newValue === undefined &&
				options.resetUnsuppliedValuesToDefaults )
			{
				thisFieldView.resetValueToDefault();
			}

			if( newValue !== undefined )
				thisFieldView.setValue( newValue );
		}

		return this;
	},

	align : function( options ) {
		var $this = $( this );

		var fieldViews = FieldView.find( $this, options );

		var maxLabelWidth =_.max( _.map( fieldViews, function( thisFieldView ) {
			if( ! thisFieldView.ui.leftLabelDiv ) return 0;

			thisFieldView.ui.leftLabelDiv.css( "width", "auto" );
			return thisFieldView._leftLabelIsTooWideToInline() ? kMinBodyIndent : thisFieldView.ui.leftLabelDiv.width() + 1;
		} ) );

		_.each( fieldViews, function( thisFieldView ) {
			thisFieldView.align( maxLabelWidth );
		} );

		return maxLabelWidth;
	}
} );
