import Link from "next/link";

export default function ButtonPrimary({
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
          className={`button-primary ${variant}`}
        >
          {icon} {title}
        </button>
      ) : (
        <Link
          href={link}
          onClick={onClick}
          className={`button-primary ${variant}`}
        >
          {icon} {title}
        </Link>
      )}
    </>
  );
}
