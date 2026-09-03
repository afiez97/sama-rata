export const state = {
  slug: null,
  trip: null,
  members: [],
  expenses: [],
  activeTab: 'expenses',
  loading: false,
  error: null,
};

export function setTripState(data) {
  state.trip = data.trip;
  state.members = data.members;
  state.expenses = data.expenses;
}
