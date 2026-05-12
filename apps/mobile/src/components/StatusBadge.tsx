import { View, Text } from 'react-native';

type Status =
  | 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED'
  | 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
  | 'REVISION_REQUESTED' | 'PAUSED'
  | string;

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT:              { bg: 'bg-slate-700',   text: 'text-slate-300',   label: 'Draft'            },
  PENDING_SIGNATURE:  { bg: 'bg-amber-900',   text: 'text-amber-300',   label: 'Needs Signature'  },
  ACTIVE:             { bg: 'bg-emerald-900', text: 'text-emerald-300', label: 'Active'           },
  COMPLETED:          { bg: 'bg-brand-900',   text: 'text-brand-300',   label: 'Completed'        },
  CANCELLED:          { bg: 'bg-red-900',     text: 'text-red-300',     label: 'Cancelled'        },
  DISPUTED:           { bg: 'bg-orange-900',  text: 'text-orange-300',  label: 'Disputed'         },
  PENDING:            { bg: 'bg-amber-900',   text: 'text-amber-300',   label: 'Pending'          },
  IN_PROGRESS:        { bg: 'bg-blue-900',    text: 'text-blue-300',    label: 'In Progress'      },
  SUBMITTED:          { bg: 'bg-violet-900',  text: 'text-violet-300',  label: 'Submitted'        },
  UNDER_REVIEW:       { bg: 'bg-indigo-900',  text: 'text-indigo-300',  label: 'Under Review'     },
  APPROVED:           { bg: 'bg-emerald-900', text: 'text-emerald-300', label: 'Approved'         },
  REJECTED:           { bg: 'bg-red-900',     text: 'text-red-300',     label: 'Rejected'         },
  REVISION_REQUESTED: { bg: 'bg-orange-900',  text: 'text-orange-300',  label: 'Needs Revision'   },
  PAUSED:             { bg: 'bg-slate-700',   text: 'text-slate-300',   label: 'Paused'           },
};

export function StatusBadge({ status }: { status: Status }) {
  const style = statusStyles[status] ?? { bg: 'bg-slate-700', text: 'text-slate-300', label: status };
  return (
    <View className={`px-2 py-0.5 rounded-full ${style.bg}`}>
      <Text className={`text-xs font-medium ${style.text}`}>{style.label}</Text>
    </View>
  );
}
