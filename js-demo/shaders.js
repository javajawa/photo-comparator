'use strict';

function vertexShader()
{
	return `
attribute vec2 a_position;

void main()
{
	gl_Position = vec4( a_position, 0.0, 1.0 );
}
`;
}

function filterFactor()
{
	return `
float factor()
{
	vec2 pos;

	// Find the distance from the central area of the image
	pos = vec2( abs( gl_FragCoord.xy / u_resolution.xy - 0.5 ) ) - u_settings.x;
	pos = max( pos, 0.0 );

	// Calculate the filtering factor based on the distance, min 0.1
	float factor;

	factor = 1.0 - u_settings.y * length( pos );
	factor = max( factor, u_settings.z );

	return factor;
}
`;
}

function perceptualHueShader()
{
	return `
precision mediump float;

uniform vec2 u_resolution;
uniform vec3 u_settings;
uniform int u_colors;
uniform sampler2D u_image;
` + filterFactor() + `
// From http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl
vec3 rgb2hsv(vec3 c)
{
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy);
	vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx);

	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 HUEtoRGB(in float H)
{
	float R = abs(H * 6. - 3.) - 1.;
	float G = 2. - abs(H * 6. - 2.);
	float B = 2. - abs(H * 6. - 4.);
	return clamp(vec3(R,G,B),0.,1.);
}

void main()
{
	vec3 col = rgb2hsv( vec3( texture2D( u_image, gl_FragCoord.xy / u_resolution.xy ) ) );

	if ( col.y > 0.25 )
	{
		col.x -= mod( col.x, 1./float(u_colors) );
		col = HUEtoRGB( col.x );
	}
	else
	{
		if ( col.z < 0.1 )
		{
			col = vec3( 0.0 );
		}
		else if( col.z > 0.9 )
		{
			col = vec3( 1.0 );
		}
		else
		{
			col = vec3( 0.5 );
		}
	}

	// Assign a grey based on this colour
	// Normalised based on distance from the center
	gl_FragColor = vec4( col, factor() );
}
`;
}

function perceptualLightShader()
{
	return `
precision mediump float;

uniform vec2 u_resolution;
uniform vec3 u_settings;
uniform sampler2D u_image;

` + filterFactor() + `
void main()
{
	float v;
	vec3 col;

	// Find the mean brightness/ligheness value
	col = vec3( texture2D( u_image, gl_FragCoord.xy/u_resolution.xy ) );

	v = length( col ) / 1.73205080757;
	v = clamp( v, 0.0, 1.0 );

	// Assign a grey based on this colour
	gl_FragColor = vec4( vec3( v ), factor() );
}
`;
}

function normalShader()
{
	return `
precision mediump float;

uniform vec2 u_resolution;
uniform sampler2D u_image;

void main()
{
	// Find the mean brightness/ligheness value
	vec3 col = vec3( texture2D( u_image, gl_FragCoord.xy/u_resolution.xy ) );

	gl_FragColor = vec4( length( col ), length( col ) * length( col ), 0.0, 1.0 ) ;
}
`;
}

function normaliseShader()
{
	return `
precision mediump float;

uniform vec2 u_resolution;
uniform sampler2D u_image;
uniform float u_offset;
uniform float u_mul;

void main()
{
	// Find the mean brightness/ligheness value
	vec4 data = vec4( texture2D( u_image, gl_FragCoord.xy/u_resolution.xy ) );

	gl_FragColor = vec4( vec3( clamp( data.r * u_mul - u_offset, 0.0, 1.0 ) ), data.a ) ;
}
`;
}

function combineShader()
{
	return `
precision mediump float;

uniform vec2 u_resolution;

uniform sampler2D u_imgl;
uniform sampler2D u_imgr;

void main()
{
	vec4 lcol;
	vec4 rcol;
	vec2 pos;

	pos = gl_FragCoord.xy/u_resolution.xy;

	lcol = vec4( texture2D( u_imgl, pos ) );
	rcol = vec4( texture2D( u_imgr, pos ) );

	gl_FragColor = vec4( lcol.rgb * rcol.rgb, rcol.a );
}
`;
}

function diffShader()
{
	return `
precision mediump float;

uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_adjust;

uniform sampler2D u_imgl;
uniform sampler2D u_imgr;

void main()
{
	vec4 lcol;
	vec4 rcol;

	lcol = vec4( texture2D( u_imgl,   gl_FragCoord.xy              / u_resolution.xy ) );
	rcol = vec4( texture2D( u_imgr, ( gl_FragCoord.xy - u_offset ) / u_resolution.xy ) );

	float dist  = distance( lcol.xyz, rcol.xyz - vec3( u_adjust ) );
	float alpha = ( lcol.a + rcol.a ) / 2.0;

	gl_FragColor = vec4( vec3( dist * alpha ), 1.0 );
}
`;
}

function cutoffCounterFilter()
{
	return `
precision mediump float;

uniform sampler2D u_img;

uniform float u_histsize;

void main()
{
	vec4 point;
	float cutOff = clamp( gl_FragCoord.x / u_histsize, 0.0, 1.0 );
	float count;

	const float width  = 1.0 / 90.0;
	const float height = 1.0 / 60.0;
	const float inc    = 1.0 / 5400.0; // 60 * 90 = 5400

	for ( float x = 0.0; x <= 1.0; x += width )
	{
		for ( float y = 0.0; y <= 1.0; y += height )
		{
			point  = vec4( texture2D( u_img, vec2( x, y ) ) );
			count += ( point.x <= cutOff  ) ? inc : 0.0;
		}
	}

	gl_FragColor = vec4( count, 0.0, 0.0, 1.0 );
}
`;
}