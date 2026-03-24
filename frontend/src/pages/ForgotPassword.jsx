import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../services/api";

const GENERIC_SUCCESS_MESSAGE =
  "Se o e-mail estiver cadastrado, enviaremos um link para redefinição de senha.";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    if (!email.trim() || !email.includes("@")) {
      setFeedback({
        tone: "error",
        message: "Informe um e-mail válido para continuar.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await requestPasswordReset({
        email,
      });

      setFeedback({
        tone: "success",
        message: response?.message || GENERIC_SUCCESS_MESSAGE,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error?.status === 429
            ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
            : error.message || "Não foi possível processar sua solicitação.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-shell">
      <div className="auth-form-copy">
        <span className="auth-form-kicker">Recuperação de acesso</span>
        <h2>Esqueci minha senha</h2>
        <p>Informe seu e-mail para receber o link de redefinição.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>E-mail</span>
          <input
            type="email"
            placeholder="você@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : "Enviar link de redefinição"}
        </button>

        {feedback ? (
          <div className={`auth-feedback is-${feedback.tone}`}>{feedback.message}</div>
        ) : null}
      </form>

      <div className="auth-secondary-actions">
        <span>Lembrou a senha?</span>
        <Link to="/login">Voltar para o login</Link>
      </div>
    </div>
  );
}

export default ForgotPassword;
