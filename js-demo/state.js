'use strict';

// Generate the global state object
function RenderChain( glcanvas )
{
	const canvas = document.getElementById( glcanvas );
	// The WebGL rednering context we are using
	/** @const {WebGLRenderingContext} */
	this.gl      = canvas.getContext( "webgl2", { antialias: false } );

	// The actual shader we're running
	/** @type {WebGLProgram} */
	this.l_filter = null;
	/** @type {WebGLProgram} */
	this.h_filter = null;
	/** @type {WebGLProgram} */
	this.c_filter = null;
	/** @type {WebGLProgram} */
	this.d_filter = null;
	/** @type {WebGLProgram} */
	this.s_filter = null;
	/** @type {WebGLProgram} */
	this.n_filter = null;
	/** @type {WebGLProgram} */
	this.N_filter = null;

	// The triangles that describe a unit rectangle
	/** @type {WebGLBuffer} */
	this.rectbuf = null;
	/** @type {WebGLFramebuffer} */
	this.fbuffer = null;

	/** @type {WebGLTexture} */
	this.interim_tex = null;
	/** @type {WebGLTexture} */
	this.histogram = null;

	// The list of input buffers to filter
	/** @type {PerceptualFilter[]} */
	this.inputs   = [];
	this.maps     = {};
	this.settings = {};
}

RenderChain.prototype.addInput = function( image, lightcanvas, ligthistogram, huecanvas )
{
	const self  = this;

	// Prepare the call back to load the input texture, and render the output
	image.onload = function()
	{
		const filter = new PerceptualFilter( self.gl, image, lightcanvas, ligthistogram, huecanvas );
		const table = document.getElementById( 'table' );
		const size  = self.inputs.length;

		let row, cell;

		self.inputs.push( filter );

		row = document.createElement( 'tr' );
		table.appendChild( row );

		row = table.firstElementChild;

		cell = document.createElement( 'td' );
		cell.appendChild( document.createTextNode( filter.image ) );
		cell.appendChild( image.cloneNode() );
		row.appendChild( cell );

		if ( size )
		{
			row = table.lastElementChild;

			cell = document.createElement( 'td' );
			cell.appendChild( document.createTextNode( filter.image ) );
			cell.appendChild( image.cloneNode() );
			row.appendChild( cell );

			for ( let i = 0; i < size; ++i )
			{
				cell = document.createElement( 'td' );
				cell.id = filter.image + ' ' + self.inputs[i].image;
				row.appendChild( cell );
			}
		}

		requestAnimationFrame( frame );
	};

	// noinspection SillyAssignmentJS
	image.src = image.src;
};

function PerceptualFilter( gl, image, lightcanvas, ligthistogram, huecanvas )
{
	// The input image to process
	this.image     = image.title || image.src.replace(/^.*[\\\/]/, '');
	this.s_texture = createTexture( gl, image );

	this.l_texture = createTexture( gl );
	this.l_raster  = createCanvas( lightcanvas );
	this.l_hist    = createCanvas( ligthistogram );
	this.sigma_x1  = null;
	this.sigma_x2  = null;

	this.h_texture = createTexture( gl );
	this.h_raster  = createCanvas( huecanvas );
}

function updateSettings()
{
	let input;

	for ( input of document.getElementsByTagName( 'input' ) )
	{
		program.settings[ input.name ] = parseFloat( input.value );
	}
	requestAnimationFrame(frame);
}

function addImage( url )
{
	const div   = document.createElement( 'div' );
	const img   = document.createElement( 'img' );
	const stack = document.createElement( 'div' );

	const l_canvas = document.createElement( 'canvas' );
	const l_hist   = document.createElement( 'canvas' );
	const h_canvas = document.createElement( 'canvas' );

	l_canvas.id = Math.random().toString(36);
	l_hist.id   = Math.random().toString(36);
	h_canvas.id = Math.random().toString(36);

	img.crossOrigin = "";
	img.src = url;

	stack.classList.add( 'stack' );
	l_hist.classList.add( 'histogram' );

	div.appendChild( img );
	div.appendChild( document.createTextNode( ' ' ) );
	stack.appendChild( l_canvas );
	stack.appendChild( document.createElement( 'br' ) );
	stack.appendChild( l_hist );
	div.appendChild( stack );
	div.appendChild( document.createTextNode( ' ' ) );
	div.appendChild( h_canvas );

	document.body.insertBefore( div, document.getElementById( 'breaker' ) );

	program.addInput( img, l_canvas.id, l_hist.id, h_canvas.id );
}