import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, setSessionToken } from "../services/api";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    if (!email.trim() || !password.trim()) {
      setFeedback({
        tone: "error",
        message: "Preencha email e senha para continuar.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await loginUser({
        email,
        password,
        rememberMe,
      });

      const token = response?.session?.token;

      if (!token) {
        throw new Error("Sessao nao recebida do backend.");
      }

      setSessionToken(token);
      setFeedback({
        tone: "success",
        message: "Login realizado com sucesso. Redirecionando...",
      });

      window.setTimeout(() => {
        navigate("/");
      }, 350);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error.message || "Nao foi possivel fazer login.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-shell">
      <div className="auth-form-copy">
        <span className="auth-form-kicker">Acesso do seller</span>
        <h2>Entrar na conta</h2>
        <p>
          Entre com seu e-mail e senha para acessar os dados da sua operacao.
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            placeholder="voce@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>Senha</span>
          <div className="auth-password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="auth-inline-action"
              onClick={() => setShowPassword((currentValue) => !currentValue)}
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>

        <div className="auth-form-meta">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Manter sessao ativa neste dispositivo</span>
          </label>

          <button type="button" className="auth-text-button">
            Esqueci minha senha
          </button>
        </div>

        <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar no ViiSync"}
        </button>

        {feedback ? (
          <div className={`auth-feedback is-${feedback.tone}`}>{feedback.message}</div>
        ) : null}
      </form>

      <div className="auth-secondary-actions">
        <span>Ainda nao tem conta?</span>
        <Link to="/cadastro">Criar conta agora</Link>
      </div>
    </div>
  );
}

export default Login;
