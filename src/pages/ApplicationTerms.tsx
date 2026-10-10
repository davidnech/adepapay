export default function ApplicationTerms({
  rules,
  layaway = {},
  swap = {},
}: {
  rules: Record<string, unknown>
  layaway?: Record<string, unknown>
  swap?: Record<string, unknown>
}) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        {[
          ["minimumDeposit", "Standard minimum deposit (%)"],
          ["minimumDuration", "Minimum hire purchase months"],
          ["maximumDuration", "Maximum hire purchase months"],
          ["gracePeriod", "Standard grace period (days)"],
          ["lateFee", "Published late charge (%)"],
          ["returns", "Return window (days)"],
          ["warranty", "Warranty (months)"],
          ["delivery", "Delivery timeframe"],
        ].map(([key, label]) => (
          <div key={key}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1">{String(rules[key] ?? "Not specified")}</dd>
          </div>
        ))}
      </dl>
      <p className="whitespace-pre-wrap">
        {String(rules.returnConditions || "")}
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        {Array.isArray(rules.clauses) &&
          rules.clauses.map((clause, index) => (
            <li key={index}>{String(clause)}</li>
          ))}
      </ol>
      {!!Object.keys(layaway).length && (
        <div className="space-y-2">
          <p className="font-semibold">Product layaway terms</p>
          <p>
            Minimum installment: GHS {String(layaway.minimumInstallment)}. Grace
            period: {String(layaway.gracePeriod)} days. Maximum missed payments:{" "}
            {String(layaway.maxMissed)}.
          </p>
          {["reservationRules", "cancellationPolicy", "refundPolicy"].map(
            (key) => (
              <p key={key} className="whitespace-pre-wrap">
                {String(layaway[key] || "")}
              </p>
            ),
          )}
        </div>
      )}
      {!!Object.keys(swap).length && (
        <p>
          Accepted devices: {String(swap.categories)}. Minimum condition:{" "}
          {String(swap.minimumCondition)}. Offer valid for{" "}
          {String(swap.validityDays)} days. {String(swap.instructions || "")}
        </p>
      )}
      <p className="text-xs text-slate-500">
        The selected product deposit and plan appear above. Payments are
        recorded after store confirmation. Automatic debits, late-charge
        collection and refunds are not processed through this page.
      </p>
    </div>
  )
}
