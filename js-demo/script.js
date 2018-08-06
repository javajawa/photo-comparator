'use strict';

/**
 * Image perceptual-compression-for-diff prototype
 *
 * Concept:
 *  - Take an input image // two input images
 *  // - Stretch / noramlise the lightness map
 *  - Downsample it to greyscale and a lower res using a fragmentShader
 *  // - Diff the two resulting images
 *  - Output the resulting image to a canvas
 *
 * To avoid interpolation, and support multi stage processing,
 * the intermediate are written to GL framebuffers, each with
 * a texture of the desired output size.
 *
 * The overall result is exported with readPixels to a javascript
 * Image object. This is currently displayed via a 2D canvas
 */

// GL Object global storage
/** @type {RenderChain} */
let program;

function main()
{
	const images = document.querySelectorAll( 'img' );
	let i;

	if ( document.readyState !== 'complete' )
	{
		return false;
	}

	// Find the GL canvas element, and prepare all the GL object,
	// including allocating pointers for textures etc.
	program = new RenderChain( 'canvas' );

	// Set up the program
	requestAnimationFrame(init);

	for ( i = 0; i < images.length; ++i )
	{
		program.addInput( images[i], 'light-pane-' + i, 'light-hist-' + i, 'hue-pane-' + i );
	}

	return true;
}

function init()
{
	const gl = program.gl;

	program.l_filter = createProgram( gl, perceptualLightShader );
	program.h_filter = createProgram( gl, perceptualHueShader );
	program.c_filter = createProgram( gl, combineShader );
	program.d_filter = createProgram( gl, diffShader );
	program.s_filter = createProgram( gl, cutoffCounterFilter );
	program.n_filter = createProgram( gl, normalShader );
	program.N_filter = createProgram( gl, normaliseShader );

	program.fbuffer = gl.createFramebuffer();

	program.interim_tex = createTexture( gl );
	program.histogram   = createTexture( gl );

	// Generate a buffer with two triangle describing the unit rectangle.
	// This is the only vertex buffer we use in this application, so we leave it bound.
	program.rectbuf = createUnitSquare( gl );

	gl.bindBuffer( gl.ARRAY_BUFFER, program.rectbuf );

	// ...I acutally don't know why I need this, but it's the variable for the
	// vertex shader.
	// TODO: Understand this.
	const lf_a_position = gl.getAttribLocation( program.l_filter, 'a_position' );
	gl.vertexAttribPointer( lf_a_position, 2, gl.FLOAT, gl.FALSE, 0, 0 );
	gl.enableVertexAttribArray( lf_a_position );

	const hf_a_position = gl.getAttribLocation( program.h_filter, 'a_position' );
	gl.vertexAttribPointer( hf_a_position, 2, gl.FLOAT, gl.FALSE, 0, 0 );
	gl.enableVertexAttribArray( hf_a_position );

	document.addEventListener( 'change', updateSettings );
	updateSettings();
}

function frame()
{
	const start    = performance.now();
	const gl       = program.gl;
	const settings = program.settings;
	const width  = settings.width;
	const height = settings.height;

	const hist_size = 32;

	// Allocate a buffer to read the output from the GL framebuffer
	const pixels      = new Uint8Array( width * height * 4 );
	const hist_pixels = new Uint8Array( hist_size * 4 );
	const f_sets = {
		u_image: null,
		u_resolution: new Float32Array( [ width, height ] ),
		u_settings:   new Float32Array( [ settings.center_size, settings.fade_rate, settings.min_cutoff ] ),
		u_colors:     new   Int32Array( [ settings.colors ] )
	};

	const d_sets = {
		u_imgl: null,
		u_imgr: null,
		u_resolution: new Float32Array( [ settings.width, settings.height ] ),
		u_offset:     new Float32Array( [ 0, 0 ] ),
		u_adjust:     new Float32Array( [ 0 ] )
	};

	let output = 0, canv, input, comp, lightDiff, hueDiff, similarity, bestX, bestY;

	resizeTexture( gl, program.interim_tex, width, height );
	resizeTexture( gl, program.histogram, hist_size, 1 );

	for ( input of program.inputs )
	{
		if ( input.sigma_x1 === null )
		{
			extractLight( gl, input, width, height, hist_size, pixels, hist_pixels, f_sets );
			extractHue( gl, input, width, height, pixels, f_sets );
		}

		for ( comp of program.inputs )
		{
			// Only compare to earlier inputs.
			if ( comp === input )
			{
				break;
			}

			var id = input.image + ' ' + comp.image;

			// Don't recalculate existing 
			if ( id in program.maps )
			{
				continue;
			}

			similarity = bestX = bestY = 0;

			for ( let x = -3; x <= 3; x += 0.5 )
			{
				for ( let y = -2; y <= 2; y += 0.5 )
				{
					d_sets.u_offset[0] = x;
					d_sets.u_offset[1] = y;

					lightDiff = diffLight( gl, input, comp, width, height, hist_size, hist_pixels, pixels, d_sets );
					hueDiff   = diffHue  ( gl, input, comp, width, height, hist_size, hist_pixels, pixels, d_sets );

					hueDiff   = Math.sqrt( lightDiff * hueDiff );

					if ( hueDiff > similarity )
					{
						similarity = hueDiff;
						bestX = x;
						bestY = y;
					}
				}
			}

			program.maps[ id ] = {
				x: bestX,
				y: bestY,
				similarity: similarity.toPrecision( 3 )
			}

			document.getElementById( id ).textContent = 'Match of ' + id + '. Rating ' +  similarity.toPrecision( 3 ) + ' Offset (' + bestX + ',' + bestY + ')';
		}
	}

	console.log( 'Total time:', Math.round( performance.now() - start ) + 'ms' );
}

function extractLight( gl, input, width, height, hist_size, pixels, hist_pixels, f_sets )
{
	// Ensure the output textures are of the correct size
	resizeTexture( gl, input.l_texture, width, height );

	// Select the input texture
	f_sets.u_image     = input.s_texture;

	// Run the light shader
	runProgram( gl, [ width, height ], program.l_filter, f_sets, input.l_texture );

	// Display the calculated mask
	textureToPixels( gl, input.l_texture, pixels, width, height );
	pixelsToCanvas( input.l_raster, pixels, width, height );

	// Calculate the light histogram (for display)
	runProgram( gl, [ hist_size, 1 ], program.s_filter, {
		u_histsize: new Float32Array( [ hist_size - 0.5 ] ),
		u_img: input.l_texture
	}, program.histogram );

	// Display the light histogram
	textureToPixels( gl, program.histogram, pixels, hist_size, 1 );
	drawHistogram( pixels, input.l_hist, hist_size );

	// Calculate the normal information
	runProgram( gl, [ width, height ], program.n_filter, {
		u_resolution: new Float32Array( [ width, height ] ),
		u_image: input.l_texture
	}, program.interim_tex );

	// Extract the stats from the texture
	textureToPixels( gl, program.interim_tex, pixels, width, height );
	input.sigma_x1 = pixels.filter( function (a,i,t) { return i % 4 == 0; } ).reduce( function( a, b ) { return a + b; } ) / 256 / width / height;
	input.sigma_x2 = pixels.filter( function (a,i,t) { return i % 4 == 1; } ).reduce( function( a, b ) { return a + b; } ) / 256 / width / height;
}

function extractHue( gl, input, width, height, pixels, f_sets )
{
	// Resize output texture
	resizeTexture( gl, input.h_texture, width, height );

	// Run the hue shader
	runProgram( gl, [ width, height ], program.h_filter, f_sets, input.h_texture );

	// Display the hue shader
	textureToPixels( gl, input.h_texture, pixels, width, height );
	pixelsToCanvas ( input.h_raster, pixels, width, height );
}

function diffLight( gl, input, comp, width, height, hist_size, hist_pixels, pixels, d_sets )
{
	// Reset the input textures for the difference shader
	d_sets.u_imgl = comp.l_texture;
	d_sets.u_imgr = input.l_texture;

	// Change the overall lightness change
	d_sets.u_adjust[0] = ( input.sigma_x1 - comp.sigma_x1 );

	// Calculate the normalised difference between the two images
	runProgram( gl, [ width, height ], program.d_filter, d_sets, program.interim_tex );

	// Calculate the histogram of the difference texture
	runProgram( gl, [ hist_size, 1 ], program.s_filter, {
		u_histsize: new Float32Array( [ hist_size - 0.5 ] ),
		u_img: program.interim_tex
	}, program.histogram );

	// Read the histogram into our memory
	textureToPixels( gl, program.histogram, hist_pixels, hist_size, 1 );

	return getLikeness( hist_pixels, hist_size );
}

function diffHue( gl, input, comp, width, height, hist_size, hist_pixels, pixels, d_sets )
{
	d_sets.u_imgl = comp.h_texture;
	d_sets.u_imgr = input.h_texture;

	runProgram( gl, [ width, height ], program.d_filter, d_sets, program.interim_tex );

	// Calculate the histogram of the difference texture
	runProgram( gl, [ hist_size, 1 ], program.s_filter, {
		u_histsize: new Float32Array( [ hist_size - 0.5 ] ),
		u_img: program.interim_tex
	}, program.histogram );

	// Read the histogram into our memory
	textureToPixels( gl, program.histogram, hist_pixels, hist_size, 1 );

	return getLikeness( hist_pixels, hist_size );
}

main() || document.addEventListener( 'readystatechange', main );
