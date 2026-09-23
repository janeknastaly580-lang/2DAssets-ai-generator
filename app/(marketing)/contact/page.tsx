export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Contact</h1>
      <p className="text-muted-foreground mt-4">
        Questions, billing issues or a rejected prompt you would like reviewed? Write to us at{" "}
        <a href="mailto:support@veyraflow.eu" className="text-primary underline">
          support@veyraflow.eu
        </a>
        . We usually answer within two business days.
      </p>
      <p className="text-muted-foreground mt-4 text-sm">A contact form will be added later. Company details are listed in the Impressum.</p>
    </div>
  );
}
