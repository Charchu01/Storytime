import { useState } from "react";
import Landing from "./components/Landing";
import CastStep from "./components/CastStep";
import StyleStep from "./components/StyleStep";
import ChatStep from "./components/ChatStep";
import PreviewStep from "./components/PreviewStep";
import "./styles.css";

export default function App() {
  const [step, setStep] = useState("landing");
  const [cast, setCast] = useState([]);
  const [style, setStyle] = useState(null);
  const [result, setResult] = useState(null);

  function reset() {
    setCast([]);
    setStyle(null);
    setResult(null);
    setStep("landing");
  }

  return (
    <div className="app">
      {step === "landing" && (
        <Landing onStart={() => setStep("cast")} />
      )}
      {step === "cast" && (
        <CastStep
          onNext={(characters) => { setCast(characters); setStep("style"); }}
          onBack={() => setStep("landing")}
        />
      )}
      {step === "style" && (
        <StyleStep
          onNext={(styleName) => { setStyle(styleName); setStep("chat"); }}
          onBack={() => setStep("cast")}
        />
      )}
      {step === "chat" && (
        <ChatStep
          cast={cast}
          style={style}
          onNext={(storyResult) => { setResult(storyResult); setStep("preview"); }}
          onBack={() => setStep("style")}
        />
      )}
      {step === "preview" && (
        <PreviewStep
          data={result}
          cast={cast}
          onReset={reset}
          onBack={() => setStep("chat")}
        />
      )}
    </div>
  );
}
