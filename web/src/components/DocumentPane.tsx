type Props = {
  documentId: string;
  ownerId: string;
  fileName: string;
  mimeType: string;
  onClose: () => void;
};

export function DocumentPane({
  documentId,
  ownerId,
  fileName,
  mimeType,
  onClose,
}: Props) {
  const src = `/api/documents/${documentId}/file?ownerId=${encodeURIComponent(ownerId)}`;
  const isImage = mimeType.startsWith("image/");

  return (
    <aside className="doc-pane" aria-label="Documento adjunto">
      <div className="doc-pane-head">
        <div className="mono doc-pane-name" title={fileName}>
          {fileName}
        </div>
        <div className="doc-pane-meta">
          <span className="mono meta-muted">
            {isImage ? "imagen" : "original"}
          </span>
          <button
            type="button"
            className="mono aside-close"
            onClick={onClose}
            aria-label="Cerrar documento"
          >
            cerrar
          </button>
        </div>
      </div>
      <div className="doc-pane-body">
        {isImage ? (
          <img className="doc-pane-image" src={src} alt={fileName} />
        ) : (
          <iframe className="doc-pane-frame" title={fileName} src={src} />
        )}
      </div>
      <div className="doc-pane-foot">
        <span className="doc-pane-swatch" aria-hidden />
        <span>
          Documento a la par del asesor. El chat sigue a la derecha.
        </span>
      </div>
    </aside>
  );
}
