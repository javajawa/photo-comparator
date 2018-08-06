'use strict';

function imageToHistogram( pixels, size, centiles )
{
	const percentiles = new Uint8Array( centiles );
	const hist = new Uint8Array( size );

	const levels = pixels.subarray( 0, size * 4 ).filter(
		function( elem, idx, array )
		{
			return idx % 4 === 0;
		}
	);

	let centile = 0;

	for ( let value = 0; value < size; ++value )
	{
		while ( levels[value] / 255 >= centile / centiles )
		{
			percentiles[ centile ] = value;
			++centile;
		}

		hist[value] = levels[value] - ( value ? levels[value - 1] : 0 );
	}

	while ( centile < centiles )
	{
		percentiles[ centile ] = size;
		++centile;
	}

	return [ hist, percentiles ];
}

function getLikeness( pixels, hist_size )
{
	const levels = new Uint8Array( [
		pixels[ 4 * 0 ],
		pixels[ 4 * Math.round( hist_size / 4 ) ],
		pixels[ 4 * Math.round( hist_size / 2 ) ]
	] );

	return Math.max( 0, 1 
	 - Math.max( 0, 0.40 - ( levels[0] / 128 ) ) * 0.8
	 - Math.max( 0, 0.70 - ( levels[1] / 192 ) ) * 0.8
	 - Math.max( 0, 1.00 - ( levels[2] / 256 ) ) * 0.8
	);
}

function drawHistogram( pixels, canv, hist_size )
{
	const [ histogram, percentiles ] = imageToHistogram( pixels, hist_size, 20 );
	const scale = 128 / histogram.reduce( function ( a, b ) { return Math.max( a,b ); } );
	const bar_width = 6;

	canv.canvas.setAttribute( 'width',  hist_size * bar_width );
	canv.canvas.setAttribute( 'height', 128 );
	canv.width  = hist_size * bar_width;
	canv.height = 128;

	canv.clearRect( 0, 0, hist_size * bar_width, 128 );
	canv.lineWidth="1";
	canv.strokeStyle="blue";

	let sum = 0;

	for ( let i = 0; i < hist_size; ++i )
	{
		sum += histogram[i] / 2;
		canv.fillStyle="green";
		canv.beginPath();
		canv.rect( bar_width * i + 3, 128 - sum, 4, sum );
		canv.fill();

		canv.fillStyle="red";
		canv.beginPath();
		canv.rect( bar_width * i, 128 - histogram[i] * scale, 4, histogram[i] * scale );
		canv.fill();
	}

	canv.beginPath();
	canv.moveTo( bar_width * percentiles[10], 0 );
	canv.lineTo( bar_width * percentiles[10], 128 );
	canv.stroke();

	canv.beginPath();
	canv.moveTo( bar_width * percentiles[13], 0 );
	canv.lineTo( bar_width * percentiles[13], 128 );
	canv.stroke();

	canv.beginPath();
	canv.moveTo( bar_width * percentiles[16], 0 );
	canv.lineTo( bar_width * percentiles[16], 128 );
	canv.stroke();

	canv.beginPath();
	canv.moveTo( 0, 0.5 * 128 );
	canv.lineTo( hist_size * bar_width, 0.5 * 128 );
	canv.stroke();

	canv.beginPath();
	canv.moveTo( 0, 0.35 * 128 );
	canv.lineTo( hist_size * bar_width, 0.35 * 128 );
	canv.stroke();

	canv.beginPath();
	canv.moveTo( 0, 0.2 * 128 );
	canv.lineTo( hist_size * bar_width, 0.2 * 128 );
	canv.stroke();
}
