import { useNavigate } from "react-router-dom";
import GenerationStep from "../../components/GenerationStep";
import ErrorBoundary from "../../components/ErrorBoundary";
import { useCreateWizard } from "../CreatePage";

export default function GeneratingStep() {
  const navigate = useNavigate();
  const { cast, style, length, tier, storySessionId, vaultChar, wizardData, handleStoryComplete } = useCreateWizard();

  return (
    <ErrorBoundary
      message="Something went wrong during story generation. Your progress may be lost, but you can try again."
      onBack={() => navigate("/create/studio")}
    >
      <GenerationStep
        cast={cast}
        style={style}
        length={length}
        tier={tier}
        storySessionId={storySessionId}
        vaultChar={vaultChar}
        wizardData={wizardData}
        onNext={handleStoryComplete}
        onBack={() => navigate("/create/studio")}
      />
    </ErrorBoundary>
  );
}
