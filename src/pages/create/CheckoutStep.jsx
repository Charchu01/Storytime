import { useCreateWizard } from "../CreatePage";
import Paywall from "../../components/Paywall";

export default function CheckoutStep() {
  const { bookType, artStyle, heroData, wizardData, handlePaid, storySessionId } = useCreateWizard();

  return (
    <Paywall
      bookType={bookType}
      artStyle={artStyle}
      heroData={heroData}
      wizardData={wizardData}
      onPaid={handlePaid}
      storySessionId={storySessionId}
    />
  );
}
