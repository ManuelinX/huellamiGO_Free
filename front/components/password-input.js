"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({ autoComplete, name }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="passwordInputWrap">
      <input
        autoComplete={autoComplete}
        name={name}
        type={isVisible ? "text" : "password"}
      />
      <button
        aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="passwordVisibilityButton"
        onClick={() => setIsVisible((currentValue) => !currentValue)}
        type="button"
      >
        {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}
