// Source of the CloudFront Function (runtime cloudfront-js-2.0, viewer request).
// It must stay plain ES5-style JavaScript, so it lives in a string.
// The Next.js export writes /de/upload as de/upload.html, so clean URLs get
// ".html" appended. "/" redirects to the default language.
export const urlRewriteCode = `
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === '/') {
    return {
      statusCode: 302,
      statusDescription: 'Found',
      headers: { location: { value: '/de' } },
    };
  }

  if (uri.charAt(uri.length - 1) === '/') {
    uri = uri.slice(0, -1);
  }

  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    uri += '.html';
  }

  request.uri = uri;
  return request;
}
`;
