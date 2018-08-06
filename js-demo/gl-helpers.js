'use strict';

function runProgram( gl, viewport, script, inputs, output )
{
	let textures = 0;

	// Set up the viewport
	gl.viewport( 0, 0, viewport[0], viewport[1] );

	// Bind the frame buffer output to the target texture, as color attachment 0
	gl.bindFramebuffer( gl.FRAMEBUFFER, program.fbuffer );

	// Make the frame buffer point to the selected output texture
	gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0 );

	// Activate the selected program
	gl.useProgram( script );

	Object.keys( inputs ).forEach( key => {
		const value = inputs[key];
		const p_var = gl.getUniformLocation( script, key );

		if ( ! p_var )
		{
			console.warn( 'Unused key in', script.id, ':', key );
			return;
		}

		if ( value instanceof WebGLTexture )
		{
			// Bind the input texture reference to the fragment
			gl.activeTexture( gl['TEXTURE' + textures] );
			gl.bindTexture  ( gl.TEXTURE_2D, value );
			gl.uniform1i    ( p_var, textures );

			++textures;
		}
		else if ( value instanceof Float32Array )
		{
			gl['uniform' + value.length + 'fv']( p_var, value );
		}
		else if ( value instanceof Int32Array )
		{
			gl['uniform' + value.length + 'iv']( p_var, value );
		}
		else
		{
			console.warn( 'Invalid value for key', key, 'in', script.id, ':', typeof value );
		}
	});

	// Run the light filter
	gl.drawArrays ( gl.TRIANGLES, 0, 6 );
	gl.bindTexture( gl.TEXTURE_2D, null );

	gl.bindFramebuffer( gl.FRAMEBUFFER, null );
}

function textureToPixels( gl, buffer, pixels, width, height )
{
	// Bind the framebuffer output to the target texture, as color attachment 0
	gl.bindFramebuffer( gl.FRAMEBUFFER, program.fbuffer );

	// Make the framebuffer point to the selected output texture
	gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, buffer, 0 );

	// Read the frame-buffer into JS memory
	gl.readPixels( 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels );

	gl.bindFramebuffer( gl.FRAMEBUFFER, null );
}

function pixelsToCanvas( canvas, pixels, width, height )
{
	canvas.width  = width;
	canvas.height = height;

	canvas.canvas.setAttribute( 'width',  width  );
	canvas.canvas.setAttribute( 'height', height );

	const image = canvas.createImageData( width, height );

	// Render to the output canvas
	image.data.set( pixels );
	canvas.putImageData( image, 0, 0 );
}

function createProgram( gl, func )
{
	const program = gl.createProgram();

	// Load the vertex and fragment shader, and set them into use.
	gl.attachShader( program, createShader( gl, gl.VERTEX_SHADER,   vertexShader ) );
	gl.attachShader( program, createShader( gl, gl.FRAGMENT_SHADER, func         ) );
	gl.linkProgram ( program );

	program.id = func.name;

	if ( !gl.getProgramParameter( program, gl.LINK_STATUS ) )
	{
		console.error( 'Unable to initialize the shader program:', gl.getProgramInfoLog( program ) );
		return null;
	}

	return program;
}

function createShader( gl, type, func )
{
	const shader = gl.createShader( type );
	const source = func();

	// Send the source to the shader object
	gl.shaderSource(shader, source);

	// Compile the shader program
	gl.compileShader(shader);

	// See if it compiled successfully
	if ( ! gl.getShaderParameter( shader, gl.COMPILE_STATUS ) )
	{
		console.error( 'An error occurred compiling the shaders:', gl.getShaderInfoLog( shader ), source );
		gl.deleteShader(shader);

		return null;
	}

	return shader;
}

function createTexture( gl, image )
{
	const texture = gl.createTexture();

	gl.bindTexture  ( gl.TEXTURE_2D, texture );
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );

	if ( image )
	{
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image );
	}

	gl.bindTexture( gl.TEXTURE_2D, null );

	return texture;
}

function resizeTexture( gl, texture, width, height )
{
	gl.bindTexture( gl.TEXTURE_2D, texture );
	gl.texImage2D ( gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null );
	gl.bindTexture( gl.TEXTURE_2D, null );
}

function createCanvas( canvas )
{
	let elem = document.getElementById( canvas );

	if ( !elem )
	{
		elem = document.createElement( 'canvas' );
		elem.id = canvas;
		document.body.appendChild( elem );
	}

	let canv = elem.getContext( '2d' );

	canv.imageSmoothingEnabled = false;

	return canv;
}

function createUnitSquare( gl )
{
	const buffer = gl.createBuffer();
	
	gl.bindBuffer( gl.ARRAY_BUFFER, buffer );
	
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([
			-1.0,  1.0,
			 1.0,  1.0,
			-1.0, -1.0,
			-1.0, -1.0,
			 1.0,  1.0,
			 1.0, -1.0
		]),
		gl.STATIC_DRAW
	);

	gl.bindBuffer( gl.ARRAY_BUFFER, null );

	return buffer;
}