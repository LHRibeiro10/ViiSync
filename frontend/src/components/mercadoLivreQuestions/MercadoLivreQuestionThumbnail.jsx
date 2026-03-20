import { useState } from "react";

function buildFallbackLabel(title) {
  const words = String(title ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "ML";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

function MercadoLivreQuestionThumbnail({
  title,
  thumbnail,
  alt,
  size = "regular",
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackLabel = buildFallbackLabel(title);

  return (
    <div className={`ml-questions-thumbnail is-${size}`}>
      {thumbnail && !imageFailed ? (
        <img
          src={thumbnail}
          alt={alt || title || "Anuncio do Mercado Livre"}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{fallbackLabel}</span>
      )}
    </div>
  );
}

export default MercadoLivreQuestionThumbnail;
