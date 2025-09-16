import * as React from "react";

interface EditIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const EditIcon = ({ className, ...props }: EditIconProps) => (
  <svg
    viewBox="0 0 528.899 528.899"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="m328.883 89.125 107.59 107.589-272.34 272.34L56.604 361.465zm189.23-25.948-47.981-47.981c-18.543-18.543-48.653-18.543-67.259 0l-45.961 45.961 107.59 107.59 53.611-53.611c14.382-14.383 14.382-37.577 0-51.959M.3 512.69c-1.958 8.812 5.998 16.708 14.811 14.565l119.891-29.069L27.473 390.597z" />
  </svg>
);
export default EditIcon;
