import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset } from "../services/api";

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = useMemo(
    () => String(searchParams.get("token") || "").trim(),
    [searchParams]
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    if (!resetToken) {
      setFeedback({
        tone: "error",
        message: "Token de redefinição ausente. Solicite um novo link de recuperação.",
      });
      return;
    }

    if (password.length < 8) {
      setFeedback({
        tone: "error",
        message: "A senha deve ter pelo menos 8 caracteres.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({
        tone: "error",
        message: "A confirmação da senha deve ser igual à senha informada.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await confirmPasswordReset({
        token: resetToken,
        password,
      });

      setFeedback({
        tone: "success",
        message: response?.message || "Senha atualizada com sucesso. Redirecionando para o login...",
      });

      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 900);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error.message || "Não foi possível redefinir sua senha.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-shell">
      <div className="auth-form-copy">
        <span className="auth-form-kicker">Recuperação</span>
        <h2>Redefinir senha</h2>
        <p>Crie uma nova senha para voltar a acessar sua conta com segurança.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>Nova senha</span>
          <input
            type="password"
            placeholder="Digite a nova senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>Confirmar nova senha</span>
          <input
            type="password"
            placeholder="Repita a nova senha"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>

        <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
          {isSubmitting ? "Atualizando senha..." : "Salvar nova senha"}
        </button>

        {feedback ? (
          <div className={`auth-feedback is-${feedback.tone}`}>{feedback.message}</div>
        ) : null}
      </form>

      <div className="auth-secondary-actions">
        <span>Lembrou da senha?</span>
        <Link to="/login">Voltar para o login</Link>
      </div>
    </div>
  );
}

export default ResetPassword;
