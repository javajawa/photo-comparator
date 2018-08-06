*This project is currently a proof of concept and is to be converted
to a C based executable*

Photo Series Comparator
=======================

This tool chain attempts to find similar images for a photo series like a
photo shoot, where images are taken in blocks, with some amount of
movement and/or lighting change, before a change in subject.

The image is 'fingerprinted' by downsampling to a fixed, small size
with two images separating out in hue and lightness values.
The hue channel is downsamples to a limited hue set, plus black and
white for very low saturation zones.
The light channel's mean and variance are calculated to allow for
changing in lighting levels (but not colour) to be compensated for.
Each of these 'fingerprint' has a "perception" mask (which reduces
the relevance of outer sections of the image) tracked in the alpha
channel.

In order to determine if two images are of the same content, a
series of diffs are preformed between them with different position
offsets.
The lightness diff also moves the values on one of the 'fingerprints'
so that the means are the same. At this time, the variance is not
altered.

The closest match, based on the 0, first quartile, and second quartile
points in the histogram of the diff are used as the match points.
The offset which results in the highest score is used as the overall
match value.
