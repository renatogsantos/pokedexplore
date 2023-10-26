import Link from "next/link";
import { motion } from "framer-motion";

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
        <motion.button
          whileHover={{ scale: .95 }}
          transition={{ duration: 0.1 }}
          type={type}
          onClick={onClick}
          className={`button-primary ${variant}`}
        >
          {icon} {title}
        </motion.button>
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
