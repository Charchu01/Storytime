import { useNavigate } from "react-router-dom";
import GenerationStep from "../../components/GenerationStep";
import { useCreateWizard } from "../CreatePage";

export default function GeneratingStep() {
  const navigate = useNavigate();
  const { cast, style, length, tier, storySessionId, vaultChar, wizardData, handleStoryComplete } = useCreateWizard();

  return (
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
  );
}
