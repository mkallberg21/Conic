import { centsToUsd, type Agreement, type Deliverable, type Payment } from "@conic/domain";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { StatCard } from "../components/StatCard";

export const DashboardPage = () => {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string>("");

  const [newAgreement, setNewAgreement] = useState({
    title: "",
    scope: "",
    amountCents: 0,
    brandName: "",
    brandEmail: "",
    creatorName: "",
    creatorEmail: ""
  });

  const [newDeliverable, setNewDeliverable] = useState({
    agreementId: "",
    description: "",
    proofUrl: ""
  });

  const totalProcessed = useMemo(() => {
    return payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  }, [payments]);

  const load = async () => {
    try {
      const [agreementsData, deliverablesData, paymentsData] = await Promise.all([
        apiClient.listAgreements(),
        apiClient.listDeliverables(),
        apiClient.listPayments()
      ]);
      setAgreements(agreementsData);
      setDeliverables(deliverablesData);
      setPayments(paymentsData);
      setError("");
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreateAgreement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await apiClient.createAgreement(newAgreement);
    setNewAgreement({
      title: "",
      scope: "",
      amountCents: 0,
      brandName: "",
      brandEmail: "",
      creatorName: "",
      creatorEmail: ""
    });
    await load();
  };

  const onSubmitDeliverable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await apiClient.submitDeliverable(newDeliverable.agreementId, {
      description: newDeliverable.description,
      proofUrl: newDeliverable.proofUrl
    });
    setNewDeliverable({ agreementId: "", description: "", proofUrl: "" });
    await load();
  };

  const onApprove = async (deliverableId: string) => {
    await apiClient.approveDeliverable(deliverableId);
    await load();
  };

  return (
    <main className="layout">
      <header className="hero">
        <p className="eyebrow">Conic Operations Console</p>
        <h1>Manage agreements, deliverables, and creator payouts in one place.</h1>
      </header>

      <section className="stats">
        <StatCard label="Active Agreements" value={agreements.length} />
        <StatCard label="Submitted Deliverables" value={deliverables.length} />
        <StatCard label="Payments Scheduled" value={payments.length} />
        <StatCard label="Total Processed" value={centsToUsd(totalProcessed)} />
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="panel-grid">
        <article className="panel">
          <h2>Create Agreement</h2>
          <form onSubmit={onCreateAgreement}>
            <input
              required
              value={newAgreement.title}
              onChange={(event) => setNewAgreement({ ...newAgreement, title: event.target.value })}
              placeholder="Campaign title"
            />
            <textarea
              required
              value={newAgreement.scope}
              onChange={(event) => setNewAgreement({ ...newAgreement, scope: event.target.value })}
              placeholder="Scope and deliverables"
            />
            <input
              required
              type="number"
              value={newAgreement.amountCents}
              onChange={(event) =>
                setNewAgreement({ ...newAgreement, amountCents: Number(event.target.value) })
              }
              placeholder="Amount in cents"
            />
            <input
              required
              value={newAgreement.brandName}
              onChange={(event) =>
                setNewAgreement({ ...newAgreement, brandName: event.target.value })
              }
              placeholder="Brand name"
            />
            <input
              required
              type="email"
              value={newAgreement.brandEmail}
              onChange={(event) =>
                setNewAgreement({ ...newAgreement, brandEmail: event.target.value })
              }
              placeholder="Brand email"
            />
            <input
              required
              value={newAgreement.creatorName}
              onChange={(event) =>
                setNewAgreement({ ...newAgreement, creatorName: event.target.value })
              }
              placeholder="Creator name"
            />
            <input
              required
              type="email"
              value={newAgreement.creatorEmail}
              onChange={(event) =>
                setNewAgreement({ ...newAgreement, creatorEmail: event.target.value })
              }
              placeholder="Creator email"
            />
            <button type="submit">Create agreement</button>
          </form>
        </article>

        <article className="panel">
          <h2>Submit Deliverable</h2>
          <form onSubmit={onSubmitDeliverable}>
            <select
              required
              value={newDeliverable.agreementId}
              onChange={(event) =>
                setNewDeliverable({ ...newDeliverable, agreementId: event.target.value })
              }
            >
              <option value="">Select agreement</option>
              {agreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.title}
                </option>
              ))}
            </select>
            <input
              required
              value={newDeliverable.description}
              onChange={(event) =>
                setNewDeliverable({ ...newDeliverable, description: event.target.value })
              }
              placeholder="Deliverable description"
            />
            <input
              required
              type="url"
              value={newDeliverable.proofUrl}
              onChange={(event) =>
                setNewDeliverable({ ...newDeliverable, proofUrl: event.target.value })
              }
              placeholder="Proof URL"
            />
            <button type="submit">Submit proof</button>
          </form>

          <h3>Pending Approval</h3>
          <ul>
            {deliverables
              .filter((item) => item.status === "submitted")
              .map((item) => (
                <li key={item.id}>
                  <p>{item.description}</p>
                  <a href={item.proofUrl} target="_blank" rel="noreferrer">
                    Review proof
                  </a>
                  <button type="button" onClick={() => void onApprove(item.id)}>
                    Approve + trigger payment
                  </button>
                </li>
              ))}
          </ul>
        </article>
      </section>

      <section className="panel">
        <h2>Payment Queue</h2>
        <ul>
          {payments.map((payment) => (
            <li key={payment.id}>
              <strong>{centsToUsd(payment.amountCents)}</strong>
              <span>{payment.status}</span>
              <span>{new Date(payment.scheduledFor).toLocaleDateString()}</span>
              <span>{payment.provider}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};
