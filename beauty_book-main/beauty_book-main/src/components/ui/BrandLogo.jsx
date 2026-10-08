export default function BrandLogo({ size = 48, className = "", alt = "BeautyBook" }) {
  return (
    <img
      src="/brand-icon.svg?v=20261008"
      width={size}
      height={size}
      alt={alt}
      className={`block object-contain ${className}`}
    />
  );
}
