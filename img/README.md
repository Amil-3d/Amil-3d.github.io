Project photos live here, one subfolder per project.

To add a photo: upload it into the project's subfolder (or make a new one), then add a line to that
project's "images" list in projects.json:

    { "src": "img/your-folder/your-photo.jpg", "alt": "what the photo shows" }

The editor at /editor.html does this for you — its Photos box takes one line per photo:

    img/your-folder/your-photo.jpg | what the photo shows

The first photo on the list is the one that shows on the card; the rest become clickable thumbnails.
Keep photos under ~1 MB each. Landscape (16:9-ish) crops best. The "alt" text is what screen readers
read aloud and what shows under the photo in the enlarged view, so write it as a plain description.
