import Link from "next/link";

export default function ButtonSecondary({
  type,
  link,
  title,
  icon,
  onClick,
  variant,
}) {
  return (
    <>
      {type ? (
        <button
          type={type}
          onClick={onClick}
          className={`button-secondary ${variant}`}
        >
          {icon} {title}
        </button>
      ) : (
        <Link
          href={link}
          onClick={onClick}
          className={`button-secondary ${variant}`}
        >
          {icon} {title}
        </Link>
      )}
    </>
  );
}
