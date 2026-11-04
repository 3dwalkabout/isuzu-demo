interface IconProps {
  /** Raw SVG markup, inlined so the strokes follow the surrounding text colour. */
  svg: string;
}

export function Icon({ svg }: IconProps) {
  return <span className="icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
