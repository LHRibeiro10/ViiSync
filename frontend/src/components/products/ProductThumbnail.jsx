import { useState } from "react";

function ProductThumbnail({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span className="products-product-thumb is-fallback" aria-hidden="true" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="products-product-thumb"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export default ProductThumbnail;
