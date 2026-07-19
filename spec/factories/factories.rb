FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "player#{n}@example.com" }
    password { "correct-horse-battery" }
    name { "Test Player" }
  end
end
